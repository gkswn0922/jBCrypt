import mysql from 'mysql2/promise';
import { BizPPurioClient } from './bizppurioClient.js';

const dbConfig = {
  host: '140.245.70.121',
  user: 'dbeaver',
  password: '12345678',
  database: 'ringtalk',
  port: 3306
};

export class MySQLClient {
  constructor() {
    this.connection = null;
    this.bizppurioClient = new BizPPurioClient();
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(dbConfig);
      console.log('MySQL 연결 성공');
    } catch (error) {
      console.error('MySQL 연결 실패:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('MySQL 연결 종료');
    }
  }

  async updateSnPinByOrderTid(orderTid, snPin) {
    try {
      if (!this.connection) {
        await this.connect();
      }

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

  async updateQrCodeByTransId(snPin, qrCode) {
    try {
      // 파라미터 검증
      if (!snPin) {
        throw new Error('snPin가 필요합니다.');
      }
      if (!qrCode) {
        throw new Error('qrCode가 필요합니다.');
      }

      if (!this.connection) {
        await this.connect();
      }

      const query = `
        UPDATE user 
        SET QR = ?, 
            updated_at = NOW() 
        WHERE snPin = ?
      `;

      console.log('QR 코드 업데이트 쿼리 실행:', { snPin, qrcode: qrCode });
      const [result] = await this.connection.execute(query, [qrCode, snPin]);
      
      if (result.affectedRows === 0) {
        throw new Error(`snPin ${snPin}에 해당하는 사용자를 찾을 수 없습니다.`);
      }

      console.log(`snPin ${snPin}의 QR 코드가 업데이트되었습니다.`);

      // QR 코드 저장 성공 후 BizPPurio API 호출
      try {
                 // 사용자 정보 조회 (전화번호 등 필요한 정보)
         const userQuery = `
           SELECT orderId, ordererTel, ordererName, productName FROM user WHERE snPin = ?
         `;
         const [userRows] = await this.connection.execute(userQuery, [snPin]);
         
         if (userRows.length > 0) {
           const user = userRows[0];
           const orderId = user.orderId;
           const phoneNumber = user.ordererTel;
           const productName = user.productName || 'eSIM 해외 데이터';
           
           if (phoneNumber) {
             console.log('BizPPurio API 호출 시작:', { snPin, qrCode, phoneNumber, orderId, productName });
             
             // BizPPurio API 호출
             await this.bizppurioClient.sendQrCodeMessage(qrCode, phoneNumber, orderId, productName);
            
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

      return result;
    } catch (error) {
      console.error('QR 코드 업데이트 실패:', error);
      throw error;
    }
  }
}
