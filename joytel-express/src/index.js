import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { router as joytelRouter } from "./routes/joytel.js";
import { MySQLClient } from "./clients/mysqlClient.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// 정적 파일 제공
app.use(express.static('public'));

// IP 화이트리스트 (전역) - 테스트용으로 임시 비활성화
// app.use(ipWhitelistMiddleware);

// JoyTel 라우트 마운트
app.use("/api/joytel", joytelRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: config.env });
});

// 관리자 대시보드 API
app.get("/api/admin/orders", async (req, res) => {
  const mysqlClient = new MySQLClient();
  
  try {
    await mysqlClient.connect();
    
    // 전체 주문 목록 조회 (최신 순)
    const ordersQuery = `
      SELECT 
        productOrderId, orderId, ordererName, ordererTel, email, 
        productName, day, quantity, snPin, QR, orderTid, kakaoSendYN, 
        created_at, updated_at
      FROM user 
      ORDER BY created_at DESC
      LIMIT 1000
    `;
    
    const [orders] = await mysqlClient.connection.execute(ordersQuery);
    
    // 통계 정보 계산
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN QR IS NOT NULL AND QR != '' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN QR IS NULL OR QR = '' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
      FROM user
    `;
    
    const [statsRows] = await mysqlClient.connection.execute(statsQuery);
    const stats = statsRows[0];
    
    res.json({
      orders: orders,
      stats: {
        total: parseInt(stats.total),
        sent: parseInt(stats.sent),
        pending: parseInt(stats.pending),
        today: parseInt(stats.today)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('관리자 대시보드 데이터 조회 실패:', error);
    res.status(500).json({ 
      error: '데이터를 불러오는데 실패했습니다.',
      message: error.message 
    });
  } finally {
    await mysqlClient.disconnect();
  }
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ringtalk 관리자 대시보드</title>
    <link rel="stylesheet" href="/css/dashboard.css">
</head>
<body>
    <div class="header">
        <h1>📊 ringtalk 관리자 대시보드</h1>
        <p>eSIM 주문 및 알림톡 전송 현황</p>
    </div>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card total">
                <h3>전체 주문</h3>
                <div class="number" id="totalOrders">-</div>
                <small>총 주문 건수</small>
            </div>
            <div class="stat-card sent">
                <h3>알림톡 전송 완료</h3>
                <div class="number" id="sentMessages">-</div>
                <small>QR 코드 발송됨</small>
            </div>
            <div class="stat-card pending">
                <h3>전송 대기</h3>
                <div class="number" id="pendingMessages">-</div>
                <small>QR 코드 미발송</small>
            </div>
            <div class="stat-card failed">
                <h3>오늘 주문</h3>
                <div class="number" id="todayOrders">-</div>
                <small>당일 신규 주문</small>
            </div>
        </div>
        
        <div class="controls">
            <button class="refresh-btn" onclick="loadData()">🔄 새로고침</button>
            <input type="text" class="search-box" id="searchBox" placeholder="주문번호, 고객명, 전화번호로 검색..." onkeyup="filterTable()">
            <div class="last-updated" id="lastUpdated"></div>
        </div>
        
        <div class="data-table">
            <div class="table-header">
                📋 주문 목록
            </div>
            <div class="table-content">
                <table id="orderTable">
                    <thead>
                        <tr>
                            <th>주문번호</th>
                            <th>고객명</th>
                            <th>전화번호</th>
                            <th>이메일</th>
                            <th>상품명</th>
                            <th>일수</th>
                            <th>수량</th>
                            <th>QR 코드</th>
                            <th>알림톡 상태</th>
                            <th>주문일시</th>
                        </tr>
                    </thead>
                    <tbody id="orderTableBody">
                        <tr>
                            <td colspan="10" class="loading">데이터를 불러오는 중...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <script src="/js/dashboard.js"></script>
</body>
</html>
  `);
});

app.listen(config.port,'0.0.0.0', () => {
  console.log(`JoyTel server listening on port ${config.port}`);
});


