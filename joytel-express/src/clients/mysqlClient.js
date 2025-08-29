import mysql from 'mysql2/promise';

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
        UPDATE orders 
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
}
