JoyTel API Integration (Express.js)

ENV
------
Create a `.env` file with:

PORT=3000
JOYTEL_IP_WHITELIST=1.2.3.4,5.6.7.8
JOYTEL_WAREHOUSE_BASE_URL=https://warehouse-api.joytel.example
JOYTEL_WAREHOUSE_CUSTOMER_CODE=yourCustomerCode
JOYTEL_WAREHOUSE_CUSTOMER_AUTH=yourCustomerAuth
JOYTEL_RSP_BASE_URL=https://rsp-api.joytel.example
JOYTEL_RSP_APP_ID=yourAppId
JOYTEL_RSP_APP_SECRET=yourAppSecret
JOYTEL_RSP_NOTIFY_BASE_URL=https://mydomain.com/api/joytel

Run
------
npm run dev

Endpoints
------
POST /api/joytel/esim/order
POST /api/joytel/esim/callback
POST /api/joytel/coupon/redeem
POST /api/joytel/notify/coupon/redeem
POST /api/joytel/esim/status-usage

Notes
------
- 실제 JoyTel 문서의 엔드포인트 경로명과 필드명을 확인하여 수정하세요.
- Warehouse: SHA-1(signature) / RSP+: MD5(AppId+TransId+Timestamp+AppSecret)
- 콜백에서 서명 검증이 필요하다면 JoyTel이 제공하는 규약에 맞춰 추가하세요.


