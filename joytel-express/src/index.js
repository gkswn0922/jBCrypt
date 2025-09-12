import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import { config } from "./config/index.js";
import { ipWhitelistMiddleware } from "./middlewares/security.js";
import { requireAuth, redirectIfAuthenticated } from "./middlewares/auth.js";
import { router as joytelRouter } from "./routes/joytel.js";
import { MySQLClient } from "./clients/mysqlClient.js";
import path from "path";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// 세션 설정
app.use(session({
  secret: 'ringtalk-admin-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTPS 사용 시 true로 변경
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
}));

// IP 화이트리스트 (전역) - 테스트용으로 임시 비활성화
// app.use(ipWhitelistMiddleware);

// eSIM QR 코드 상세페이지 라우트 (정적 파일 서빙보다 먼저 설정)
app.get("/esim/qr-detail", (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'public/esim-qr-detail.html');
    res.sendFile(filePath);
  } catch (err) {
    console.error('eSIM QR 상세페이지 로딩 실패:', err);
    res.status(500).json({ error: '페이지를 불러올 수 없습니다.' });
  }
});

// JoyTel 라우트 마운트
app.use("/api/joytel", joytelRouter);

// 정적 파일 제공 설정 수정 (라우트 설정 후에 배치)
app.use(express.static(path.join(process.cwd(), 'public')));

// 로그인 API
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  
  // 하드코딩된 관리자 계정 정보
  const ADMIN_USERNAME = 'ringtalk';
  const ADMIN_PASSWORD = 'dnjf1000djr!';
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    req.session.username = username;
    res.json({ 
      success: true, 
      message: '로그인 성공',
      username: username 
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: '아이디 또는 비밀번호가 올바르지 않습니다.' 
    });
  }
});

// 로그아웃 API
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: '로그아웃 실패' });
    }
    res.json({ success: true, message: '로그아웃 성공' });
  });
});

// 로그인 상태 확인 API
app.get("/api/auth/status", (req, res) => {
  res.json({
    isAuthenticated: !!(req.session && req.session.isAuthenticated),
    username: req.session?.username || null
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: config.env });
});

// 관리자 대시보드 API
app.get("/api/admin/orders", requireAuth, async (req, res) => {
  const mysqlClient = new MySQLClient();
  
  try {
    await mysqlClient.connect();
    
    // 전체 주문 목록 조회 (최신 순)
    const ordersQuery = `
      SELECT 
        productOrderId, orderId, ordererName, ordererTel, email, 
        productName, day, quantity, snCode, QR, orderTid, kakaoSendYN, 
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

// 로그인 페이지
app.get("/login", redirectIfAuthenticated, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ringtalk 관리자 로그인</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .login-header h1 {
            color: #333;
            margin-bottom: 0.5rem;
        }
        
        .login-header p {
            color: #666;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #333;
            font-weight: 500;
        }
        
        .form-group input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e1e5e9;
            border-radius: 5px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .login-btn {
            width: 100%;
            padding: 0.75rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .login-btn:hover {
            transform: translateY(-2px);
        }
        
        .login-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .error-message {
            background: #fee;
            color: #c33;
            padding: 0.75rem;
            border-radius: 5px;
            margin-bottom: 1rem;
            display: none;
        }
        
        .loading {
            display: none;
            text-align: center;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>🔐 관리자 로그인</h1>
            <p>ringtalk 관리자 대시보드에 접근하세요</p>
        </div>
        
        <div class="error-message" id="errorMessage"></div>
        <div class="loading" id="loading">로그인 중...</div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">아이디</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">비밀번호</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit" class="login-btn" id="loginBtn">로그인</button>
        </form>
    </div>
    
    <script>
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');
            const loading = document.getElementById('loading');
            const loginBtn = document.getElementById('loginBtn');
            
            // 에러 메시지 숨기기
            errorMessage.style.display = 'none';
            
            // 로딩 상태 표시
            loading.style.display = 'block';
            loginBtn.disabled = true;
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // 로그인 성공 시 대시보드로 이동
                    window.location.href = '/';
                } else {
                    // 로그인 실패 시 에러 메시지 표시
                    errorMessage.textContent = data.message;
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                errorMessage.textContent = '로그인 중 오류가 발생했습니다.';
                errorMessage.style.display = 'block';
            } finally {
                loading.style.display = 'none';
                loginBtn.disabled = false;
            }
        });
    </script>
</body>
</html>
  `);
});

app.get("/", requireAuth, (req, res) => {
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
        <div class="header-content">
            <div class="header-info">
                <h1>📊 ringtalk 관리자 대시보드</h1>
                <p>eSIM 주문 및 알림톡 전송 현황</p>
            </div>
            <div class="header-actions">
                <span class="user-info" id="userInfo">관리자</span>
                <button class="logout-btn" onclick="logout()">로그아웃</button>
            </div>
        </div>
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
                            <th>SN CODE</th>
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


