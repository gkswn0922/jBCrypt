import mysql from 'mysql2/promise';
import { BizPPurioClient } from './bizppurioClient.js';

const dbConfig = {
  host: '140.245.70.121',
  user: 'dbeaver',
  password: '12345678',
  database: 'ringtalk',
  port: 3306,
  enableKeepAlive: true,
  // 연결 풀 설정 추가
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

export class MySQLClient {
  constructor() {
    this.connection = null;
    this.bizppurioClient = new BizPPurioClient();
  }

  async connect() {
    try {
      // 기존 연결이 있으면 정리
      if (this.connection) {
        try {
          await this.connection.end();
        } catch (error) {
          console.log('기존 연결 정리 중 오류 (무시됨):', error.message);
        }
      }
      
      this.connection = await mysql.createConnection(dbConfig);
      console.log('MySQL 연결 성공');
    } catch (error) {
      console.error('MySQL 연결 실패:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      try {
        await this.connection.end();
        console.log('MySQL 연결 종료');
      } catch (error) {
        console.log('연결 종료 중 오류 (무시됨):', error.message);
      } finally {
        this.connection = null;
      }
    }
  }

  // 연결 상태 확인 및 재연결
  async ensureConnection() {
    try {
      // 연결이 없거나 끊어진 경우
      if (!this.connection) {
        await this.connect();
        return;
      }

      // 연결 상태 확인
      await this.connection.ping();
    } catch (error) {
      console.log('연결 상태 확인 실패, 재연결 시도:', error.message);
      await this.connect();
    }
  }

  async updateSnPinByOrderTid(orderTid, snPin) {
    try {
      await this.ensureConnection();

      const query = `
        UPDATE user 
        SET snPin = ?, 
            updated_at = NOW() 
        WHERE orderTid = ?
      `;

      const [result] = await this.connection.execute(query, [snPin, orderTid]);
      
      if (result.affectedRows === 0) {
        throw new Error(`orderTid ${orderTid}에 해당하는 주문을 찾을 수 없습니다.`);
      }

      console.log(`orderTid ${orderTid}의 snPin이 ${snPin}으로 업데이트되었습니다.`);
      return result;
    } catch (error) {
      console.error('snPin 업데이트 실패:', error);
      throw error;
    }
  }

  async updateSnCodeByOrderTid(orderTid, snCode) {
    try {
      await this.ensureConnection();

      const query = `
        UPDATE user 
        SET snCode = ?, 
            updated_at = NOW() 
        WHERE orderTid = ?
      `;

      const [result] = await this.connection.execute(query, [snCode, orderTid]);
      
      if (result.affectedRows === 0) {
        throw new Error(`orderTid ${orderTid}에 해당하는 주문을 찾을 수 없습니다.`);
      }

      console.log(`orderTid ${orderTid}의 snCode가 ${snCode}으로 업데이트되었습니다.`);
      return result;
    } catch (error) {
      console.error('snCode 업데이트 실패:', error);
      throw error;
    }
  }

  async updateQrCodeByTransId(snPinString, qrCodeString) {
    try {
      // 파라미터 검증
      if (!snPinString) {
        throw new Error('snPin이 필요합니다.');
      }
      if (!qrCodeString) {
        throw new Error('qrCode가 필요합니다.');
      }

      await this.ensureConnection();

      // | 구분자로 분리하고 빈 문자열 제거
      const snPins = snPinString.split('|').filter(sn => sn.trim());
      const qrCodes = qrCodeString.split('|').filter(qr => qr.trim());

      console.log('QR 코드 업데이트 쿼리 실행:', { 
        snPinCount: snPins.length, 
        qrCodeCount: qrCodes.length,
        snPins: snPins,
        qrCodes: qrCodes
      });

      // 필터링된 QR 코드들을 다시 |로 연결
      const filteredQrCodeString = qrCodes.join('|');

      // snPin 전체 문자열로 사용자 찾기 (| 구분자로 저장된 경우)
      const query = `
        UPDATE user 
        SET QR = ?, 
            updated_at = NOW() 
        WHERE snPin = ?
      `;

      const [result] = await this.connection.execute(query, [filteredQrCodeString, snPinString]);
      let updatedCount = result.affectedRows;
      
      if (updatedCount > 0) {
        console.log(`snPin ${snPinString}의 QR 코드가 업데이트되었습니다.`);
      } else {
        // 전체 문자열로 찾지 못한 경우, 개별 snPin으로 시도
        console.log('전체 snPin 문자열로 찾지 못함, 개별 snPin으로 시도');
        
        for (let i = 0; i < snPins.length; i++) {
          const snPin = snPins[i];
          const qrCode = qrCodes[i] || ''; // qrCode가 없는 경우 빈 문자열

          // LIKE 패턴으로 snPin이 포함된 레코드 찾기
          const individualQuery = `
            UPDATE user 
            SET QR = CASE 
              WHEN QR IS NULL OR QR = '' THEN ?
              ELSE CONCAT(QR, '|', ?)
            END,
            updated_at = NOW() 
            WHERE snPin LIKE ? OR snPin LIKE ? OR snPin LIKE ? OR snPin = ?
          `;

          const likePatterns = [
            `%|${snPin}|%`,  // 중간에 있는 경우
            `${snPin}|%`,    // 맨 앞에 있는 경우  
            `%|${snPin}`,    // 맨 뒤에 있는 경우
            snPin            // 단독인 경우
          ];

          const [individualResult] = await this.connection.execute(individualQuery, [
            qrCode, qrCode, ...likePatterns
          ]);
          
          if (individualResult.affectedRows > 0) {
            updatedCount += individualResult.affectedRows;
            console.log(`snPin ${snPin}의 QR 코드가 업데이트되었습니다.`);
          } else {
            console.warn(`snPin ${snPin}에 해당하는 사용자를 찾을 수 없습니다.`);
          }
        }
      }

      if (updatedCount === 0) {
        throw new Error(`모든 snPin에 대해 업데이트할 수 있는 사용자를 찾을 수 없습니다.`);
      }

      console.log(`총 ${updatedCount}개의 snPin에 대해 QR 코드가 업데이트되었습니다.`);

      // QR 코드 저장 성공 후 BizPPurio API 호출
      try {
        // 먼저 전체 snPin 문자열로 사용자 정보 조회
        let userQuery = `
          SELECT orderId, ordererTel, ordererName, productName, day FROM user WHERE snPin = ?
        `;
        let [userRows] = await this.connection.execute(userQuery, [snPinString]);
        
        // 전체 문자열로 찾지 못한 경우, 개별 snPin으로 시도
        if (userRows.length === 0) {
          const validSnPin = snPins.find(sn => sn.trim());
          if (validSnPin) {
            userQuery = `
              SELECT orderId, ordererTel, ordererName, productName, day FROM user 
              WHERE snPin LIKE ? OR snPin LIKE ? OR snPin LIKE ? OR snPin = ?
            `;
            const likePatterns = [
              `%|${validSnPin}|%`,  // 중간에 있는 경우
              `${validSnPin}|%`,    // 맨 앞에 있는 경우  
              `%|${validSnPin}`,    // 맨 뒤에 있는 경우
              validSnPin            // 단독인 경우
            ];
            [userRows] = await this.connection.execute(userQuery, likePatterns);
          }
        }
        
        if (userRows.length > 0) {
          const user = userRows[0];
          const orderId = user.orderId;
          const phoneNumber = user.ordererTel;
          const productName = user.productName || 'eSIM 해외 데이터';
          const day = user.day || 1;
          
          if (phoneNumber) {
            console.log('BizPPurio API 호출 시작:', { 
              snPinCount: snPins.length,
              qrCodeCount: qrCodes.length,
              phoneNumber, 
              orderId, 
              productName 
            });
            
            // BizPPurio API 호출 (필터링된 QR 코드 문자열 사용)
            await this.bizppurioClient.sendQrCodeMessage(filteredQrCodeString, phoneNumber, orderId, productName, day);
           
            console.log('BizPPurio API 호출 완료');
          } else {
            console.warn('사용자 전화번호가 없어 BizPPurio API 호출을 건너뜁니다.');
          }
        } else {
          console.warn('사용자 정보를 찾을 수 없어 BizPPurio API 호출을 건너뜁니다.');
        }
      } catch (bizppurioError) {
        console.error('BizPPurio API 호출 실패:', bizppurioError);
        // BizPPurio API 실패해도 QR 코드 저장은 성공으로 처리
      }

      return { updatedCount, totalCount: snPins.length };
    } catch (error) {
      console.error('QR 코드 업데이트 실패:', error);
      throw error;
    }
  }
}
