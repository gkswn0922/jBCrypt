import express from "express";
import { submitEsimOrder } from "../clients/warehouseClient.js";
import { redeemCoupon, queryEsimStatusUsage } from "../clients/rspClient.js";
import { requireJsonContent } from "../middlewares/security.js";
import { MySQLClient } from "../clients/mysqlClient.js";
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from "crypto";
// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AppId = "39q97DPCzyj1";
const AppSecret = "E24C1750751A46ACA9931772DF67BBFA";
const TransId = Date.now().toString(); // 고유 트랜잭션 ID
const Timestamp = Date.now();

const rawString = AppId + TransId + Timestamp + AppSecret;

const Ciphertext = createHash("md5")
  .update(rawString)
  .digest("hex");

// Winston 로거 설정
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // 콘솔 출력
    new winston.transports.Console(),
    // 파일 출력 - 일반 로그
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/joytel-api.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // 파일 출력 - 에러 로그
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/joytel-api-error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

export const router = express.Router();

// MySQL 클라이언트 인스턴스 생성
const mysqlClient = new MySQLClient();

// 1) eSIM Order Submit (Warehouse)
router.post("/", requireJsonContent, async (req, res) => {
  try {
    const _payload = req.body;
    // TODO: 비즈니스 로직: DB 업데이트, 상태 변경, 로그 적재 등
    // 필요 시 JoyTel 서명 검증 로직 추가
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// 1) eSIM Order Submit (Warehouse)
router.post("/esim/order", requireJsonContent, async (req, res) => {
  try {
    const result = await submitEsimOrder(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "eSIM order submit failed", error: err?.message || String(err) });
  }
});

// 2) eSIM Order Result Callback (snPin)
router.post("/esim/callback", requireJsonContent, async (req, res) => {
  try {
    const _payload = req.body;
    
    // 외부로부터 받은 파라미터들을 로그로 기록
    logger.info('eSIM Callback API 호출', {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: _payload,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: '/esim/callback'
    });

    // orderTid와 snPin 추출
    const { orderTid, itemList } = _payload;
    
    if (!orderTid) {
      return res.status(400).json({ 
        ok: false, 
        error: 'orderTid가 필요합니다.' 
      });
    }

    if (!itemList || !Array.isArray(itemList) || itemList.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'itemList가 필요합니다.' 
      });
    }

    // 모든 itemList의 snPin을 추출
    const allSnPins = [];
    
    for (const item of itemList) {
      if (!item.snList || !Array.isArray(item.snList) || item.snList.length === 0) {
        return res.status(400).json({ 
          ok: false, 
          error: 'snList가 필요합니다.' 
        });
      }
      
      for (const sn of item.snList) {
        if (sn.snPin) {
          allSnPins.push(sn.snPin);
        }
      }
    }
    
    if (allSnPins.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'snPin이 필요합니다.' 
      });
    }
    
    // | 구분자로 연결
    const snPinString = allSnPins.join('|');

    // 데이터베이스에서 orderTid로 조회하여 snPin 업데이트
    try {
      await mysqlClient.updateSnPinByOrderTid(orderTid, snPinString);
      
      logger.info('snPin 업데이트 성공', {
        orderTid,
        snPinCount: allSnPins.length,
        snPins: allSnPins,
        snPinString,
        timestamp: Date.now().toString()
      });

      // snPin 업데이트 성공 후 각 snPin마다 coupon redeem API 호출
      try {
        const qrCodes = [];
        const failedSnPins = [];
        
        for (const snPin of allSnPins) {
          try {
            // 각 snPin마다 새로운 TransId와 Timestamp 생성
            const individualTransId = Date.now().toString();
            const individualTimestamp = Date.now();
            const individualRawString = AppId + individualTransId + individualTimestamp + AppSecret;
            const individualCiphertext = createHash("md5")
              .update(individualRawString)
              .digest("hex");
            
            const couponResponse = await fetch('https://esim.joytelecom.com/openapi/coupon/redeem', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                "AppId": AppId,
                "TransId": individualTransId,
                "Timestamp": individualTimestamp,
                "Ciphertext": individualCiphertext
              },
              body: JSON.stringify({
                coupon: snPin
              })
            });

            const couponResult = await couponResponse.text();
            
            logger.info('Coupon redeem API 호출 완료', {
              orderTid,
              snPin,
              couponApiStatus: couponResponse.status,
              couponApiResponse: couponResult,
              timestamp: individualTimestamp
            });

            if (couponResponse.ok) {
              // 성공한 경우 qrcode 추출 (응답에서 qrcode 필드 추출)
              try {
                const couponData = JSON.parse(couponResult);
                if (couponData.qrcode) {
                  qrCodes.push(couponData.qrcode);
                } else {
                  qrCodes.push(''); // qrcode가 없는 경우 빈 문자열
                }
              } catch (parseError) {
                qrCodes.push(''); // JSON 파싱 실패 시 빈 문자열
              }
            } else {
              failedSnPins.push(snPin);
              qrCodes.push(''); // 실패한 경우 빈 문자열
              logger.warn('Coupon redeem API 호출 실패', {
                orderTid,
                snPin,
                status: couponResponse.status,
                response: couponResult
              });
            }
            
            // API 호출 간격 조절 (너무 빠르게 호출하지 않도록)
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (individualError) {
            failedSnPins.push(snPin);
            qrCodes.push(''); // 개별 호출 실패 시 빈 문자열
            logger.error('개별 Coupon redeem API 호출 중 오류', {
              orderTid,
              snPin,
              error: individualError.message,
              timestamp: new Date().toISOString()
            });
          }
        }
        
        // 모든 qrcode를 | 구분자로 연결
        const qrCodeString = qrCodes.join('|');
        
        // qrcode 업데이트
        if (qrCodeString.trim()) {
          await mysqlClient.updateQrCodeByTransId(snPinString, qrCodeString);
          logger.info('QR 코드 업데이트 완료', {
            orderTid,
            qrCodeCount: qrCodes.filter(qr => qr !== '').length,
            qrCodeString
          });
        }
        
        // 실패한 snPin이 있는 경우 로그
        if (failedSnPins.length > 0) {
          logger.warn('일부 snPin 처리 실패', {
            orderTid,
            failedSnPins,
            failedCount: failedSnPins.length,
            totalCount: allSnPins.length
          });
        }

      } catch (couponError) {
        logger.error('Coupon redeem API 호출 중 오류', {
          orderTid,
          error: couponError.message,
          timestamp: new Date().toISOString()
        });
        // coupon API 실패해도 전체 응답은 성공으로 처리
      }

      return res.status(200).json({ 
        ok: true, 
        message: 'snPin이 성공적으로 업데이트되었습니다.',
        orderTid,
        snPinCount: allSnPins.length,
        snPins: allSnPins
      });
    } catch (dbError) {
      logger.error('데이터베이스 업데이트 실패', {
        orderTid,
        snPinCount: allSnPins.length,
        snPins: allSnPins,
        error: dbError.message,
        timestamp: new Date().toISOString()
      });

      return res.status(500).json({ 
        ok: false, 
        error: '데이터베이스 업데이트 실패: ' + dbError.message 
      });
    }

  } catch (err) {
    // 에러 로깅도 추가
    logger.error('eSIM Callback API 에러', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// 3) Coupon Redeem (RSP+)
router.post("/coupon/redeem", requireJsonContent, async (req, res) => {
  try {
    const result = await redeemCoupon(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "coupon redeem failed", error: err?.message || String(err) });
  }
});

// 4) Coupon Redeem Result Callback (QR code)
router.post("/notify/coupon/redeem", requireJsonContent, async (req, res) => {
  try {
    const { transId, resultCode, resultMesg, finishTime, data } = req.body;
    
    // 외부로부터 받은 파라미터들을 로그로 기록
    logger.info('Coupon Redeem Callback API 호출', {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : 'null',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: '/notify/coupon/redeem'
    });

    if (!data.qrcode) {
      return res.status(400).json({ 
        ok: false, 
        error: 'data.qrcode가 필요합니다.' 
      });
    }

    // 디버깅을 위한 파라미터 로깅
    logger.info('파라미터 검증 완료', {
      transId,
      coupon: data.coupon,
      qrcode: data.qrcode,
      resultCode,
      resultMesg,
      finishTime
    });

         // 데이터베이스에 QR 코드 저장 (BizPPurio API 호출 포함)
     try {
       await mysqlClient.updateQrCodeByTransId(data.coupon, data.qrcode);
       
       logger.info('QR 코드 업데이트 및 BizPPurio API 호출 완료', {
         coupon: data.coupon,
         qrcode: data.qrcode,
         resultCode,
         resultMesg,
         finishTime,
         timestamp: new Date().toISOString()
       });

       return res.status(200).json({ 
         ok: true, 
         message: 'QR 코드가 성공적으로 저장되었습니다.',
         transId
       });
    } catch (dbError) {
      logger.error('QR 코드 저장 실패', {
        transId,
        qrcode: data.qrcode,
        error: dbError.message,
        timestamp: new Date().toISOString()
      });

      return res.status(500).json({ 
        ok: false, 
        error: 'QR 코드 저장 실패: ' + dbError.message 
      });
    }
  } catch (err) {
    // 에러 로깅
    logger.error('Coupon Redeem Callback API 에러', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// 5) eSIM Status/Usage helper (RSP+)
router.post("/esim/status-usage", requireJsonContent, async (req, res) => {
  try {
    const result = await queryEsimStatusUsage(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "status/usage query failed", error: err?.message || String(err) });
  }
});

router.post("/notify/esim/esim-progress", requireJsonContent, async (req, res) => {
  try {
    const _payload = req.body;
    // TODO: 비즈니스 로직: DB 업데이트, 상태 변경, 로그 적재 등
    // 필요 시 JoyTel 서명 검증 로직 추가
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
})

