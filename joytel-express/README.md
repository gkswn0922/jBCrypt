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

# 주문 스케줄러 실행
npm run scheduler      # 프로덕션 모드
npm run scheduler:dev  # 개발 모드 (nodemon)

Endpoints
------
POST /api/joytel/esim/order
POST /api/joytel/esim/callback
POST /api/joytel/coupon/redeem
POST /api/joytel/notify/coupon/redeem
POST /api/joytel/esim/status-usage

스케줄러 (Order Scheduler)
------
주문 스케줄러는 1분마다 다음 작업을 수행합니다:

1. **주문 정보 수집**: NaverCommerceApiClient(Java)를 실행하여 네이버 커머스 API에서 새로운 주문 정보를 가져옵니다.
2. **중복 방지**: productOrderId와 orderId를 기준으로 중복된 주문은 저장하지 않습니다.
3. **데이터베이스 저장**: 새로운 주문 정보를 ringtalk.user 테이블에 저장합니다.
4. **카카오 메시지 처리**: 
   - orderTid가 null이고 kakaoSendYN이 'N'인 주문을 찾습니다.
   - CustomerApiClient(Java)를 호출하여 orderTid를 생성/업데이트합니다.
   - BizPPurio API를 통해 카카오 메시지를 전송합니다.
   - 메시지 전송 성공 시 kakaoSendYN을 'Y'로 업데이트합니다.

### 필수 요구사항:
- Java 환경 설정 (NaverCommerceApiClient, CustomerApiClient 실행용)
- MySQL 데이터베이스 연결
- ringtalk.user 테이블 구조
- BizPPurio API 토큰 설정

### 로그 확인:
스케줄러 실행 중 모든 과정이 콘솔에 로깅됩니다. 오류 발생 시 해당 단계만 건너뛰고 다음 처리를 계속 진행합니다.

Notes
------
- 실제 JoyTel 문서의 엔드포인트 경로명과 필드명을 확인하여 수정하세요.
- Warehouse: SHA-1(signature) / RSP+: MD5(AppId+TransId+Timestamp+AppSecret)
- 콜백에서 서명 검증이 필요하다면 JoyTel이 제공하는 규약에 맞춰 추가하세요.


