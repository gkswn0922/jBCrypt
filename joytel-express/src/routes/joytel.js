import express from "express";
import { submitEsimOrder } from "../clients/warehouseClient.js";
import { redeemCoupon, queryEsimStatusUsage } from "../clients/rspClient.js";
import { requireJsonContent } from "../middlewares/security.js";
import { MySQLClient } from "../clients/mysqlClient.js";
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // 첫 번째 아이템의 snList에서 snPin 추출
    const firstItem = itemList[0];
    if (!firstItem.snList || !Array.isArray(firstItem.snList) || firstItem.snList.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'snList가 필요합니다.' 
      });
    }

    const snPin = firstItem.snList[0].snPin;
    if (!snPin) {
      return res.status(400).json({ 
        ok: false, 
        error: 'snPin이 필요합니다.' 
      });
    }

    // 데이터베이스에서 orderTid로 조회하여 snPin 업데이트
    try {
      await mysqlClient.updateSnPinByOrderTid(orderTid, snPin);
      
      logger.info('snPin 업데이트 성공', {
        orderTid,
        snPin,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({ 
        ok: true, 
        message: 'snPin이 성공적으로 업데이트되었습니다.',
        orderTid,
        snPin
      });
    } catch (dbError) {
      logger.error('데이터베이스 업데이트 실패', {
        orderTid,
        snPin,
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
    const _payload = req.body;
    // TODO: 비즈니스 로직: 쿠폰 상태 업데이트, QR 저장 등
    return res.status(200).json({ ok: true });
  } catch (err) {
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

