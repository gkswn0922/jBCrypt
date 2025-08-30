import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { ipWhitelistMiddleware } from "./middlewares/security.js";
import { router as joytelRouter } from "./routes/joytel.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// IP 화이트리스트 (전역) - 테스트용으로 임시 비활성화
// app.use(ipWhitelistMiddleware);

// JoyTel 라우트 마운트
app.use("/api/joytel", joytelRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: config.env });
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ringtalk 관리자</title>
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
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
            text-align: center;
        }
        
        .logo {
            margin-bottom: 2rem;
        }
        
        .logo h1 {
            color: #333;
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        
        .logo p {
            color: #666;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
            text-align: left;
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
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.3s ease;
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
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        
        .login-btn:hover {
            transform: translateY(-2px);
        }
        
        .login-btn:active {
            transform: translateY(0);
        }
        
        .status-info {
            margin-top: 1.5rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        
        .status-info h3 {
            color: #333;
            font-size: 1rem;
            margin-bottom: 0.5rem;
        }
        
        .status-info p {
            color: #666;
            font-size: 0.9rem;
            line-height: 1.4;
        }
        
        .api-endpoints {
            margin-top: 1.5rem;
            text-align: left;
        }
        
        .api-endpoints h3 {
            color: #333;
            font-size: 1rem;
            margin-bottom: 0.5rem;
        }
        
        .endpoint {
            background: #f8f9fa;
            padding: 0.5rem;
            margin-bottom: 0.5rem;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.8rem;
            color: #333;
        }
        
        .endpoint.method {
            color: #667eea;
            font-weight: bold;
        }
        
        .endpoint.path {
            color: #666;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>🔐 ringtalk</h1>
            <p>관리자 로그인</p>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">사용자명</label>
                <input type="text" id="username" name="username" placeholder="관리자 계정을 입력하세요" required>
            </div>
            
            <div class="form-group">
                <label for="password">비밀번호</label>
                <input type="password" id="password" name="password" placeholder="비밀번호를 입력하세요" required>
            </div>
            
            <button type="submit" class="login-btn">로그인</button>
        </form>
        
        <div class="status-info">
            <h3>📊 서버 상태</h3>
            <p>환경: ${config.env}<br>
            포트: ${config.port}<br>
            상태: <span style="color: #28a745;">정상</span></p>
        </div>
        
        <div class="api-endpoints">
            <h3>🔗 API 엔드포인트</h3>
            <div class="endpoint">
                <span class="method">GET</span> <span class="path">/health</span> - 서버 상태 확인
            </div>
            <div class="endpoint">
                <span class="method">POST</span> <span class="path">/api/joytel/esim/order</span> - eSIM 주문
            </div>
            <div class="endpoint">
                <span class="method">POST</span> <span class="path">/api/joytel/coupon/redeem</span> - 쿠폰 리딤
            </div>
            <div class="endpoint">
                <span class="method">POST</span> <span class="path">/api/joytel/esim/status-usage</span> - 상태 조회
            </div>
        </div>
    </div>
    
    <script>
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // 간단한 검증 (실제로는 서버에서 처리해야 함)
            if (username === 'admin' && password === 'joytel2024') {
                alert('로그인 성공! 관리자 페이지로 이동합니다.');
                // 여기에 실제 로그인 후 리다이렉트 로직 추가
            } else {
                alert('사용자명 또는 비밀번호가 올바르지 않습니다.');
            }
        });
        
        // 입력 필드 포커스 효과
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.style.transform = 'scale(1.02)';
            });
            
            input.addEventListener('blur', function() {
                this.parentElement.style.transform = 'scale(1)';
            });
        });
    </script>
</body>
</html>
  `);
});

app.listen(config.port,'0.0.0.0', () => {
  console.log(`JoyTel server listening on port ${config.port}`);
});


