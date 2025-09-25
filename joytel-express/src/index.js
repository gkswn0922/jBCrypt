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
import QRCode from "qrcode";
import { createCanvas, loadImage } from "canvas";
import CryptoJS from "crypto-js";

const app = express();

// MySQL 클라이언트 인스턴스 생성
const mysqlClient = new MySQLClient();

// 데이터 사용량 조회 API 함수
async function queryDataUsage(snPin, transId) {
  try {
    if (!snPin) {
      console.log('snPin이 없어 데이터 사용량 조회를 건너뜁니다.');
      return null;
    }

    console.log('데이터 사용량 조회 시작:', { snPin });

    // 헤더 생성
    const appId = '39q97DPCzyj1';
    const timestamp = Date.now();
    const transId = Date.now().toString();
    const appSecret = 'E24C1750751A46ACA9931772DF67BBFA';
    
    // MD5 해시 생성
    const str = appId + transId + timestamp + appSecret;
    const ciphertext = CryptoJS.MD5(str).toString();

    console.log('API 헤더 정보:', { appId, transId, timestamp, ciphertext });

    const response = await fetch('https://esim.joytelecom.com/openapi/esim/usage/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppId': appId,
        'TransId': transId,
        'Timestamp': timestamp,
        'Ciphertext': ciphertext
      },
      body: JSON.stringify({
        coupon: snPin
      })
    });

    const result = await response.json();
    console.log('데이터 사용량 조회 결과:', result);
    
    return result;
  } catch (error) {
    console.error('데이터 사용량 조회 중 오류 발생:', error);
    return null;
  }
}

// 나라명 매핑 객체
const countryMapping = {
  '베트남': 'VIETNAM',
  '일본': 'JAPAN', 
  '중국': 'CHINA',
  '말레이시아': 'MALAYSIA',
  '필리핀': 'PHILIPPINES',
  '인도네시아': 'INDONESIA',
  '싱가폴': 'SINGAPORE',
  '홍마': 'HONGKONG',
  '미국': 'USA',
  '터키': 'TURKEY',
  '대만': 'TAIWAN',
  '태국': 'THAILAND',
  '호뉴': 'AUSTRALIA'
};

// 어두운 배경을 가진 나라들 (로고와 국가명을 하얀색으로 변경)
const darkBackgroundCountries = ['HONGKONG', 'CHINA','PHILIPPINES', 'INDONESIA', 'TAIWAN', 'THAILAND'];

// 나라별 이모지 매핑
const countryEmojiMapping = {
  'VIETNAM': '../assets/VT.png',
  'JAPAN': '../assets/JP.png',
  'CHINA': '../assets/CN.png',
  'MALAYSIA': '../assets/MY.png',
  'PHILIPPINES': '../assets/PL.png',
  'INDONESIA': '../assets/ID.png',
  'SINGAPORE': '../assets/SP.png',
  'HONGKONG': '../assets/HK.png',
  'USA': '../assets/US.png',
  'TURKEY': '../assets/TR.png',
  'TAIWAN': '../assets/TW.png',
  'THAILAND': '../assets/TH.png',
  'AUSTRALIA': '../assets/AU.png'
};

// 나라명 추출 및 영문명 변환 함수
function extractCountryFromProductName(productName) {
  if (!productName) return null;
  
  for (const [koreanName, englishName] of Object.entries(countryMapping)) {
    if (productName.includes(koreanName)) {
      return {
        koreanName,
        englishName,
        flagClass: `flag-${englishName.toLowerCase()}`,
        emoji: countryEmojiMapping[englishName],
        isDarkBackground: darkBackgroundCountries.includes(englishName)
      };
    }
  }
  return null;
}

// 배경 이미지 변경 함수
function updateBackgroundImage(countryInfo) {
  if (!countryInfo) return;
  
  const container = document.querySelector('.container');
  if (container) {
    container.style.backgroundImage = `url('/assets/${countryInfo.englishName.toLowerCase()}.png')`;
  }
}

// QR 코드에서 활성화 코드 추출 함수
function extractActivationCode(qrCode) {
  if (!qrCode) return 'N/A';
  
  // $ 구분자로 분리하여 마지막 부분 추출
  const parts = qrCode.split('$');
  if (parts.length > 0) {
    return parts[parts.length - 1]; // 마지막 부분 반환
  }
  
  return qrCode; // $가 없으면 원본 반환
}

// 데이터 사용량 조회 함수
async function getDataUsage(snPin) {
  try {
    console.log('데이터 사용량 조회 시도:', snPin);
    
    const response = await fetch('https://esim.joytelecom.com/openapi/esim/usage/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coupon: snPin
      })
    });
    
    const result = await response.json();
    console.log('데이터 사용량 조회 결과:', result);
    
    if (result.code === '000' && result.data && result.data.dataUsageList && result.data.dataUsageList.length > 0) {
      // 가장 최근 사용량 반환 (usageDate 기준으로 정렬)
      const sortedUsage = result.data.dataUsageList.sort((a, b) => b.usageDate.localeCompare(a.usageDate));
      const latestUsage = sortedUsage[0];
      
      return {
        success: true,
        usage: parseInt(latestUsage.usage), // 바이트 단위
        usageDate: latestUsage.usageDate,
        mcc: latestUsage.mcc
      };
    } else {
      console.log('데이터 사용량 조회 실패 또는 데이터 없음:', result);
      return {
        success: false,
        usage: 0,
        usageDate: null,
        mcc: null
      };
    }
    
  } catch (error) {
    console.error('데이터 사용량 조회 중 오류:', error);
    return {
      success: false,
      usage: 0,
      usageDate: null,
      mcc: null,
      error: error.message
    };
  }
}

// 상품명에서 데이터 용량 추출 함수 (기가바이트)
function extractDataCapacity(productName) {
  if (!productName) return 1; // 기본값 1GB
  
  // 상품명에서 숫자와 "기가", "GB", "g" 등을 찾아서 추출
  const patterns = [
    /(\d+(?:\.\d+)?)\s*기가/gi,
  ];
  
  for (const pattern of patterns) {
    const match = productName.match(pattern);
    if (match) {
      const capacity = parseFloat(match[0].replace(/[^\d.]/g, ''));
      return capacity || 1; // 숫자 추출 실패 시 기본값 1GB
    }
  }
  
  return 1; // 패턴 매칭 실패 시 기본값 1GB
}

// 바이트를 기가바이트로 변환
function bytesToGB(bytes) {
  return bytes / (1024 * 1024 * 1024);
}

// 기가바이트를 바이트로 변환
function gbToBytes(gb) {
  return gb * 1024 * 1024 * 1024;
}

// eSIM Progress 데이터 조회 함수
async function getEsimProgressData(identifier) {
  try {
    console.log(`eSIM 데이터 조회 시도: ${identifier}`);
    await mysqlClient.connect();
    
    // 1. eSIM Progress 데이터 조회
    const esimQuery = `
      SELECT 
        transId, snPin, cid, qrCode, notificationPointId,
        created_at, updated_at
      FROM esim_progress_notifications 
      WHERE transId = ? OR cid = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const [esimRows] = await mysqlClient.connection.execute(esimQuery, [identifier, identifier]);
    console.log(`조회 결과:`, esimRows.length > 0 ? '데이터 발견' : '데이터 없음');
    
    if (esimRows.length === 0) {
      return null;
    }
    
    const esimData = esimRows[0];
    console.log('조회된 eSIM 데이터:', esimData);
    
    // 2. snPin으로 user 테이블에서 상품 정보 조회
    if (esimData.snPin) {
      const userQuery = `
        SELECT productName, day
        FROM user 
        WHERE snPin LIKE ? 
        LIMIT 1
      `;
      
      const [userRows] = await mysqlClient.connection.execute(userQuery, [`%${esimData.snPin}%`]);
      
      if (userRows.length > 0) {
        const userData = userRows[0];
        console.log('조회된 상품 정보:', userData);
        
        // 상품 정보를 esimData에 추가
        esimData.productName = userData.productName;
        esimData.day = userData.day;
        
        // 나라명 추출 및 처리
        const countryInfo = extractCountryFromProductName(userData.productName);
        if (countryInfo) {
          esimData.countryInfo = countryInfo;
          console.log('나라 정보 추출:', countryInfo);
        }
      } else {
        console.log('상품 정보를 찾을 수 없음');
        esimData.productName = null;
        esimData.day = null;
      }
    }
    
    return esimData;
  } catch (error) {
    console.error('eSIM Progress 데이터 조회 실패:', error);
    return null;
  } finally {
    await mysqlClient.disconnect();
  }
}

// 상태 매핑 함수
function getStatusInfo(notificationPointId) {
  const statusMap = {
    '1': { text: "단말기 호환성을 확인하는 중입니다.", color: "blue", icon: "🔍" },
    '2': { text: "설치가 취소되었거나 승인되지 않았습니다.", color: "red", icon: "❌" },
    '3': { text: "eSIM 프로파일을 다운로드 중입니다.", color: "orange", icon: "⬇️" },
    '4': { text: "eSIM 프로파일을 설치하는 중입니다.", color: "purple", icon: "⚙️" },
    '5': { text: "eSIM 프로파일이 삭제되었습니다.", color: "gray", icon: "🗑️" },
    '6': { text: "eSIM이 활성화되었습니다.", color: "green", icon: "✅" },
    '7': { text: "eSIM이 비활성화되었습니다.", color: "yellow", icon: "⏸️" },
    '101': { text: "이 기기의 eSIM(EID)이 차단되어 사용이 불가능합니다.", color: "red", icon: "🚫" },
    '102': { text: "해당 기종은 eSIM 사용이 제한되어 있습니다.", color: "red", icon: "📱" }
  };
  
  return statusMap[notificationPointId] || { 
    text: "상태를 확인하는 중입니다.", 
    color: "gray", 
    icon: "⏳" 
  };
}

// 상태에 따른 메시지 함수
function getStatusMessage(notificationPointId) {
  const messageMap = {
    1: "상품 사용시간(한국시간 기준) 단말기 호환성 확인 중입니다.",
    2: "상품 사용시간(한국시간 기준) 설치가 취소되었습니다.",
    3: "상품 사용시간(한국시간 기준) 프로파일 다운로드 중입니다.",
    4: "상품 사용시간(한국시간 기준) 프로파일 설치 중입니다.",
    5: "상품 사용시간(한국시간 기준) 프로파일이 삭제되었습니다.",
    6: "상품 사용시간(한국시간 기준) 활성화 완료! 사용 가능합니다.",
    7: "상품 사용시간(한국시간 기준) 비활성화 상태입니다.",
    101: "상품 사용시간(한국시간 기준) 기기 차단으로 사용 불가능합니다.",
    102: "상품 사용시간(한국시간 기준) 기종 제한으로 사용 불가능합니다."
  };
  
  return messageMap[notificationPointId] || "상품 사용시간(한국시간 기준) 상태를 확인하는 중입니다.";
}

// QR 코드 생성 함수 (로고 없이)
async function generateQRCodeWithLogo(text, logoPath) {
  console.log("generateQRCodeWithLogo");
  try {
    // QR 코드 생성 (로고 없이)
    const qrCodeBuffer = await QRCode.toBuffer(text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeBuffer;
    
  } catch (error) {
    console.error('QR 코드 생성 실패:', error);
    throw error;
  }
}

// QR 코드 생성 함수 (로고 포함)
async function generateQRCodeImage(qrCodeData) {
  console.log("generateQRCodeImage");
  if (!qrCodeData) return null;
  
  try {
    // qrCodeData가 JSON인 경우 파싱
    let qrData = qrCodeData;
    if (typeof qrCodeData === 'string') {
      try {
        qrData = JSON.parse(qrCodeData);
      } catch (e) {
        // JSON이 아닌 경우 그대로 사용
        qrData = qrCodeData;
      }
    }
    
    // 로고 파일 경로
    // const logoPath = path.join(__dirname, '../public/assets/logo-ringtalk.png');
    
    // QR 코드 생성 (로고 없이)
    const qrCodeBuffer = await generateQRCodeWithLogo(qrData, null);
    
    return `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;
    
  } catch (error) {
    console.error('QR 코드 생성 실패:', error);
    return null;
  }
}

// HTML 템플릿 렌더링 함수
async function renderEsimDetailPage(esimData) {
  console.log(esimData);
  const qrCodeImage = await generateQRCodeImage(esimData.qrCode);
  
  // 서버에서 데이터 사용량 조회
  let usageData = null;
  if (esimData.snPin) {
    usageData = await queryDataUsage(esimData.snPin, esimData.transId || Date.now().toString());
    console.log("usageData", usageData);
    
    // 데이터 사용량이 있으면 notificationPointId를 6으로 고정
    if (usageData && usageData.code === '000' && usageData.data && usageData.data.dataUsageList && usageData.data.dataUsageList.length > 0) {
      esimData.notificationPointId = '6';
      console.log("데이터 사용량 확인됨, notificationPointId를 6으로 설정");
    }
  }
  
  // 상태 정보 계산 (데이터 사용량 조회 후)
  const statusInfo = getStatusInfo(esimData.notificationPointId);
  
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>RingTalk eSIM 설치 설명서</title>

      <!-- Inter 폰트 -->
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />

      <!-- 스타일 -->
      <link rel="stylesheet" href="/style.css" />
      
      <!-- 상태 표시 스타일 -->
      <style>
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px;
        }
        .status-blue { background: #e3f2fd; color: #1976d2; }
        .status-green { background: #e8f5e8; color: #2e7d32; }
        .status-orange { background: #fff3e0; color: #f57c00; }
        .status-purple { background: #f3e5f5; color: #7b1fa2; }
        .status-red { background: #ffebee; color: #c62828; }
        .status-yellow { background: #fffde7; color: #f9a825; }
        .status-gray { background: #f5f5f5; color: #616161; }
        
        /* 어두운 배경용 스타일 */
        .header.dark-bg .logo img {
          filter: brightness(0) invert(1);
        }
        .banner.dark-bg .country span:first-child {
          color: white !important;
        }
        
        /* 이모지 스타일 */
        .flag-emoji {
          font-size: 1em;                    /* 글자 크기와 동일하게 */
          margin-left: 8px;
          display: inline-block;              /* 인라인 블록으로 설정 */
          vertical-align: middle;             /* 수직 정렬 */
          width: 40px;
        }
        
        /* 프로그래스 바 스타일 */
        .progress-bar-container {
          margin: 15px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .progress-bar {
          flex: 1;
          height: 8px;
          background-color: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%);
          border-radius: 4px;
          transition: width 0.3s ease;
          width: 0%;
        }
        
        .progress-text {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          min-width: 35px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- 헤더 -->
        <header class="header ${esimData.countryInfo && esimData.countryInfo.isDarkBackground ? 'dark-bg' : ''}">
          <h1 class="logo" aria-label="RingTalk">
            <img src="/assets/logo-ringtalk.svg" alt="RingTalk" />
          </h1>
          <a href="https://smartstore.naver.com/ringtalk/notice/list?cp=1" class="badge" target="_blank">eSIM 설치 설명서</a>
        </header>

        <!-- 국가 배너 -->
        ${esimData.countryInfo ? `
        <section class="banner ${esimData.countryInfo.isDarkBackground ? 'dark-bg' : ''}">
          <h2 class="country">
            <span>${esimData.countryInfo.englishName}</span>
            <img class="flag-emoji" src="${esimData.countryInfo.emoji}"></img>
          </h2>
        </section>
        ` : `
        <section class="banner">
          <h2 class="country">
            <span>JAPAN</span>
            <span class="flag-emoji" aria-hidden="true">🇯🇵</span>
          </h2>
        </section>
        `}

        <!-- 본문 카드 -->
        <section class="card">
          <!-- 상단 유리 박스 -->
          <div class="glass">
            <div class="qr-and-copy">
              <div class="qr-section">
                <div class="chip">eSIM</div>
                <h3>QR 코드<br>스캔하세요!</h3>
                <p class="sub">우측 QR코드를<br>스캔해서 설치하세요.</p>
              </div>
              ${qrCodeImage ? 
                `<img src="${qrCodeImage}" alt="QR 코드" class="qr">` : 
                `<img src="/assets/qr-placeholder.png" alt="QR 코드" class="qr">`
              }
            </div>

            <div class="info">
              <p><b>ICCID :</b> ${esimData.cid || 'N/A'}</p>
              <p class="product-line"><b>상품명 :</b> ${esimData.productName && esimData.day ? `${esimData.productName} / ${esimData.day}일` : (esimData.snPin || 'N/A')}</p>
            </div>
          </div>

          <!-- ▼▼▼ 흰 패널 안에 '그룹 + 알림 + 강조 + 데이터' 모두 넣기 ▼▼▼ -->
          <div class="panel">
            <div class="groups">
              <!-- 아이폰 그룹 -->
              <div class="group group--ios">
                <div class="group-title title--ios">아이폰</div>
                <div class="field field--smdp">
                  <div class="field-content">
                    <span class="label">SM-DP+ 주소</span>
                  </div>
                  <button class="button copy-btn" data-copy="rsp-eu.simlessly.com">복사</button>
                </div>
                <div class="field field--ios-act">
                  <div class="field-content">
                    <span class="label">활성화 코드</span>
                  </div>
                  <button class="button copy-btn" data-copy="${extractActivationCode(esimData.qrCode)}">복사</button>
                </div>
              </div>

              <!-- 안드로이드 그룹 -->
              <div class="group group--android">
                <div class="group-title title--and">안드로이드</div>
                <div class="field field--and-act">
                  <div class="field-content">
                    <span class="label">활성화 코드</span>
                  </div>
                  <button class="button copy-btn" data-copy="${esimData.qrCode || 'N/A'}">복사</button>
                </div>
              </div>
            </div>

            <!-- 안내/강조/데이터도 패널 내부로 -->
            <p class="notice">※ QR 코드 미작동 시, 수동으로 복사 붙여넣기하여 사용하세요.</p>
            <p class="emph">${getStatusMessage(esimData.notificationPointId)}</p>

            <div class="data">
              <div class="data-progress-bar">
                <span class="data-label">잔여 데이터</span>
                <span class="data-value" id="remainingData">로딩 중...</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar" id="progressBar">
                  <div class="progress-fill" id="progressFill"></div>
                </div>
                <span class="progress-text" id="progressText">0%</span>
              </div>
              <p class="data-disclaimer">실 사용량과 다소 차이가 있을 수 있습니다.</p>
              <p class="total">누적 데이터 <span id="totalUsage">0.00 GB</span></p>
            </div>
          </div>
        </section>

        <!-- 푸터 (컨테이너 안) -->
        <footer class="footer">
          <span>카톡(한국시간)</span>
          <svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="footer-logo">
            <g filter="url(#filter0_d_1_60)">
              <path d="M16.6 20.54H15.8C14.94 20.54 14.16 19.96 14.16 18.88C14.16 18.06 14.72 17.22 15.72 17.22H16.1C17.3 17.22 18.3 16.88 18.3 15.64C18.3 14.48 17.26 14.12 16.34 14.12H14.04C13.58 14.12 13.56 14.54 13.56 14.66C13.4 17.92 13.5 22.1 13.58 24.64C13.6 25.28 13.04 26.02 11.88 26.02C10.44 26.02 10.18 25.14 10.14 24.66C10 22.88 10 13.92 10.26 12.26C10.42 11.2 11.46 10.78 11.98 10.78H16C20.3 10.78 21.7 13.14 21.7 15.66C21.7 17.26 21.1 18.76 19.8 19.66C20.6 21.48 21.22 22.96 21.64 24.02C21.94 24.76 21.18 25.66 20.5 25.9C19.8 26.16 18.8 26.02 18.48 25.24C17.94 24.04 17.44 22.58 16.6 20.54ZM27.1413 16.28C27.2213 18.9 27.2613 21.5 27.1413 24.68C27.1013 25.44 26.1413 26.06 25.2813 26.02C24.4013 25.98 23.6813 25.36 23.6813 24.54C23.7613 21.56 23.7413 19.18 23.7013 16.36C23.7013 15.56 24.4013 15.02 25.2413 14.94C26.1613 14.86 27.1413 15.32 27.1413 16.28ZM27.1613 11.7V12.56C27.1013 13.5 26.2013 13.98 25.2413 13.9C24.3613 13.82 23.7413 13.34 23.7213 12.7L23.7013 11.92C23.6613 11.06 24.6613 10.6 25.3413 10.6C26.1813 10.6 27.1213 10.96 27.1613 11.7ZM36.3908 19.92C36.3908 18.82 36.0708 18.08 35.4308 18.08H35.0508C34.2508 18.08 33.6308 17.32 33.6308 16.4C33.6308 15.5 34.2508 14.74 35.0108 14.74H35.5908C39.0308 14.74 39.8108 16.98 39.8108 19.72C39.8108 21.06 39.7908 23.46 39.7508 24.56C39.7308 25.18 39.4308 26.02 38.0308 26.02C36.8108 26.02 36.3108 25.2 36.3108 24.52C36.3108 23.26 36.3908 20.94 36.3908 19.92ZM33.0508 24.7C33.0508 25.14 32.5308 26.02 31.3708 26.02C30.2308 26.02 29.6308 25.24 29.6108 24.5C29.5508 22.02 29.5308 18.46 29.6108 16.16C29.6308 15.56 30.1908 14.68 31.3708 14.68C32.4308 14.68 33.0708 15.42 33.0508 16.18C32.9908 18.38 32.9708 21.64 33.0508 24.7ZM46.7355 29.22C45.5155 29.26 44.3355 28.94 43.5755 28.46C43.0755 28.2 42.5755 27.38 42.9955 26.58C43.5355 25.62 44.3755 25.52 45.0955 25.92C45.5755 26.18 46.0155 26.34 46.8155 26.34C47.9555 26.34 48.5555 25.4 48.6155 24.08C48.6955 22.46 48.6155 20.06 48.5155 18.2C48.5155 18.04 48.4755 17.6 47.9755 17.6H46.9155C45.5755 17.6 44.7755 18.56 44.7755 19.82C44.7755 21.16 45.4555 22.1 46.3755 22.1H46.7755C47.4555 22.1 47.9355 22.74 47.9355 23.5C47.9355 24.26 47.5155 24.98 46.7955 24.98H46.2155C43.0355 24.98 41.3755 22.8 41.3755 19.84C41.3755 17.36 42.8155 14.74 46.8555 14.74H49.9355C50.9955 14.74 51.6955 15.38 51.8555 16.26C51.9955 17.2 52.0955 21.22 52.0155 23.88C51.8955 27.58 49.5755 29.12 46.7355 29.22ZM55.1425 14.14H52.3225C51.6625 14.14 51.0825 13.5 51.0825 12.5C51.0825 11.64 51.5825 10.78 52.3225 10.78H61.3425C62.1025 10.78 62.5825 11.42 62.5825 12.48C62.5825 13.36 62.1025 14.14 61.3225 14.14H58.5825C58.6225 17.4 58.6225 21.94 58.5825 24.6C58.5825 25.48 57.8225 26.06 56.8025 26.02C55.8025 25.98 55.1225 25.4 55.1225 24.56C55.1425 21.88 55.2025 17.28 55.1425 14.14ZM66.3825 14.58C69.0625 14.6 71.3025 15.94 71.3425 19.42C71.3425 20.72 71.3425 23.6 71.1825 24.58C71.0225 25.46 70.3625 26.02 69.5025 26.02H66.5625C63.3825 26.02 61.0825 24.96 61.0825 22.4C61.0825 20.04 62.2225 18.74 64.7625 18.74H66.1025C66.8425 18.74 67.2625 19.32 67.2625 20.1C67.2625 20.82 66.9025 21.5 66.0825 21.5H65.3625C64.7625 21.5 64.4825 21.92 64.4825 22.38C64.4825 23 65.2225 23.28 66.1025 23.28H67.2825C67.8225 23.28 67.8425 22.8 67.8625 22.6C67.9225 21.24 67.9425 20.32 67.9425 19.76C67.9425 18.24 67.6425 17.46 66.2425 17.42C65.6025 17.4 64.3425 17.56 63.7625 17.62C62.6825 17.68 62.2425 17.1 62.2025 16.34C62.1625 15.38 62.8425 14.96 63.5025 14.8C64.4625 14.6 65.8025 14.58 66.3825 14.58ZM76.7589 11.88C77.1989 15.36 76.9989 22.6 76.7789 24.82C76.6989 25.64 75.8989 26.08 74.9389 26.02C74.0789 25.96 73.3389 25.36 73.3989 24.5C73.6589 21.48 73.6789 15.1 73.3989 12.36C73.2789 11.44 74.0789 10.88 74.8989 10.78C75.7189 10.68 76.6589 11.14 76.7589 11.88ZM88.4811 17.76L82.8011 22.14C82.8211 23.04 82.8811 23.86 82.9411 24.5C83.0211 25.36 82.2611 25.96 81.4011 26.02C80.4411 26.08 79.6411 25.64 79.5611 24.82C79.3411 22.6 79.1411 15.36 79.5811 11.88C79.6811 11.14 80.6211 10.68 81.4411 10.78C82.2611 10.88 83.0411 11.44 82.9411 12.36C82.8011 13.66 82.7411 15.8 82.7411 18L86.3211 15.12C86.7811 14.74 87.8811 14.7 88.4611 15.46C89.1011 16.24 88.9411 17.34 88.4811 17.76ZM87.3811 21.44L89.1011 23.36C89.6611 24 89.3611 25.14 88.7011 25.68C87.9011 26.3 86.9411 26.02 86.5611 25.6L84.8411 23.7C84.3211 23.14 84.4611 22.06 85.1611 21.44C85.8811 20.88 86.8811 20.86 87.3811 21.44Z" fill="white"/>
            </g>
            <defs>
              <filter id="filter0_d_1_60" x="0" y="0.599976" width="99.6611" height="38.66" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset/>
                <feGaussianBlur stdDeviation="5"/>
                <feComposite in2="hardAlpha" operator="out"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.470588 0 0 0 0 1 0 0 0 0.3 0"/>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_60"/>
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_60" result="shape"/>
              </filter>
            </defs>
          </svg>
          <span>09:00-19:00</span>
        </footer>
      </div>

      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // 배경 이미지 변경
          const countryInfo = ${esimData.countryInfo ? JSON.stringify(esimData.countryInfo) : 'null'};
          if (countryInfo) {
            const container = document.querySelector('.container');
            if (container) {
              container.style.backgroundImage = 'url(/assets/' + countryInfo.englishName.toLowerCase() + '.png)';
              console.log('배경 이미지 변경:', countryInfo.englishName.toLowerCase());
            }
          }
          
          // 서버에서 조회한 데이터 사용량 정보를 사용하여 UI 업데이트
          function updateDataUsageUI() {
            const usageData = ${usageData ? JSON.stringify(usageData) : 'null'};
            const productName = '${esimData.productName || ''}';

            console.log(usageData)
            
            if (usageData && usageData.code === '000' && usageData.data) {
              const totalUsage = usageData.data.totalUsage;
              
              // 상품명에서 데이터 용량 추출 (기가바이트)
              function extractDataCapacity(productName) {
                if (!productName) return 1;
                
                const patterns = [
                  /(\\d+(?:\\.\\d+)?)\\s*기가/gi,
                ];
                
                for (const pattern of patterns) {
                  const match = productName.match(pattern);
                  if (match) {
                    const capacity = parseFloat(match[0].replace(/[^\\d.]/g, ''));
                    return capacity || 1;
                  }
                }
                
                return 1;
              }
              
              const totalCapacityGB = extractDataCapacity(productName);
              const totalCapacityBytes = totalCapacityGB * 1024 * 1024 * 1024;
              
              let displayUsedGB, displayRemainingGB, displayPercentage;
              
              if (productName.includes('매일')) {
                // 매일 상품: totalUsage를 직접 사용 (dataUsageList가 없을 수 있음)
                displayUsedGB = totalUsage / (1024 * 1024 * 1024); // 바이트를 기가바이트로 변환
                displayRemainingGB = (totalCapacityBytes - totalUsage) / (1024 * 1024 * 1024); // 바이트를 기가바이트로 변환
                displayPercentage = Math.min((totalUsage / totalCapacityBytes) * 100, 100);
              } else if (productName.includes('총')) {
                // 총 상품: 누적 사용량을 그대로 표시
                displayUsedGB = totalUsage / (1024 * 1024 * 1024); // 바이트를 기가바이트로 변환
                displayRemainingGB = (totalCapacityBytes - totalUsage) / (1024 * 1024 * 1024); // 바이트를 기가바이트로 변환
                displayPercentage = Math.min((totalUsage / totalCapacityBytes) * 100, 100);
              } else {
                // 기본: dataUsageList가 있는 경우 최신 사용량 사용, 없으면 totalUsage 사용
                if (usageData.data.dataUsageList && usageData.data.dataUsageList.length > 0) {
                  const sortedUsage = usageData.data.dataUsageList.sort((a, b) => b.usageDate.localeCompare(a.usageDate));
                  const latestUsage = sortedUsage[0];
                  const usedBytes = parseInt(latestUsage.usage);
                  const usedGB = usedBytes / (1024 * 1024 * 1024);
                  const remainingGB = totalCapacityGB - usedGB;
                  const usagePercentage = Math.min((usedBytes / totalCapacityBytes) * 100, 100);
                  
                  displayUsedGB = usedGB;
                  displayRemainingGB = remainingGB;
                  displayPercentage = usagePercentage;
                } else {
                  // dataUsageList가 없는 경우 totalUsage 사용
                  displayUsedGB = totalUsage / (1024 * 1024 * 1024);
                  displayRemainingGB = (totalCapacityBytes - totalUsage) / (1024 * 1024 * 1024);
                  displayPercentage = Math.min((totalUsage / totalCapacityBytes) * 100, 100);
                }
              }
              
              // UI 업데이트
              const remainingDataElement = document.getElementById('remainingData');
              const progressFillElement = document.getElementById('progressFill');
              const progressTextElement = document.getElementById('progressText');
              const totalUsageElement = document.getElementById('totalUsage');
              
              if (remainingDataElement) {
                if(totalCapacityGB == 1) {
                  remainingDataElement.textContent = '무제한 입니다.';
                } else {
                 remainingDataElement.textContent = displayRemainingGB.toFixed(2) + ' GB';
                }
                
              }
              
              if (progressFillElement) {
                progressFillElement.style.width = displayPercentage + '%';
              }
              
              if (progressTextElement) {
                progressTextElement.textContent = displayPercentage.toFixed(1) + '%';
              }
              console.log(displayUsedGB)
              
              if (totalUsageElement) {
                totalUsageElement.textContent = displayUsedGB.toFixed(2) + ' GB';
              }
              
              console.log('데이터 사용량 업데이트 완료:', {
                totalCapacityGB,
                displayUsedGB,
                displayRemainingGB,
                displayPercentage,
                productType: productName.includes('매일') ? '매일' : productName.includes('총') ? '총' : '기본'
              });
              
            } else {
              console.log('데이터 사용량 조회 실패 또는 데이터 없음');
              
              // 기본값으로 설정
              const remainingDataElement = document.getElementById('remainingData');
              if (remainingDataElement) {
                remainingDataElement.textContent = '데이터 없음';
              }
            }
          }
          
          // 페이지 로드 시 데이터 사용량 UI 업데이트
          updateDataUsageUI();
          
          // 복사 버튼 이벤트 리스너 추가
          const copyButtons = document.querySelectorAll('.copy-btn');
          
          copyButtons.forEach(function(button) {
            button.addEventListener('click', function() {
              const textToCopy = this.getAttribute('data-copy');
              
              navigator.clipboard.writeText(textToCopy).then(function() {
                // 복사 성공 피드백
                button.textContent = '복사됨!';
                button.style.background = '#4CAF50';
                
                setTimeout(() => {
                  button.textContent = '복사';
                  button.style.background = '';
                }, 2000);
              }).catch(function(err) {
                console.error('복사 실패:', err);
                // 폴백: 텍스트 선택 방식
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                // 피드백 표시
                button.textContent = '복사됨!';
                button.style.background = '#4CAF50';
                
                setTimeout(() => {
                  button.textContent = '복사';
                  button.style.background = '';
                }, 2000);
              });
            });
          });
        });
      </script>
    </body>
    </html>
  `;
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
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

// eSIM QR 코드 상세페이지 라우트 (동적 라우팅으로 변경)
app.get("/esim/qr-detail", async (req, res) => {
  console.log(req);
  try {
    const { transId, cid } = req.query;
    
    if (!transId && !cid) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>eSIM 정보 없음 - RingTalk</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">잘못된 접근입니다</h1>
          <p>transId 또는 cid 파라미터가 필요합니다.</p>
          <p>예: /esim/qr-detail?transId=TXN123 또는 /esim/qr-detail?cid=CUSTOMER001</p>
        </body>
        </html>
      `);
    }

    // DB에서 데이터 조회
    const esimData = await getEsimProgressData(transId || cid);
    
    if (!esimData) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>eSIM 정보 없음 - RingTalk</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; text-align: center; padding: 50px; }
            .not-found { color: #7f8c8d; }
          </style>
        </head>
        <body>
          <h1 class="not-found">eSIM 정보를 찾을 수 없습니다</h1>
          <p>올바른 링크로 접근해주세요.</p>
          <p>조회한 ID: ${transId || cid}</p>
        </body>
        </html>
      `);
    }

    // HTML 템플릿 렌더링
    const html = await renderEsimDetailPage(esimData);
    res.send(html);
    
  } catch (err) {
    console.error('eSIM QR 상세페이지 로딩 실패:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>오류 발생 - RingTalk</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1 class="error">오류가 발생했습니다</h1>
        <p>잠시 후 다시 시도해주세요.</p>
      </body>
      </html>
    `);
  }
});

// JoyTel 라우트 마운트
app.use("/api/joytel", joytelRouter);

// 정적 파일 제공 설정 수정 (라우트 설정 후에 배치)
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

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
  try {
    await mysqlClient.connect();
    
    // 전체 주문 목록 조회 (최신 순)
    const ordersQuery = `
      SELECT 
        productOrderId, orderId, ordererName, ordererTel, email, 
        productName, day, quantity, snCode, QR, orderTid, kakaoSendYN, 
        created_at, updated_at, snPin
      FROM user 
      ORDER BY created_at DESC
      LIMIT 1000
    `;
    
    const [orders] = await mysqlClient.connection.execute(ordersQuery);
    
    // 통계 정보 계산 (한국시간 기준)
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN QR IS NOT NULL AND QR != '' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN QR IS NULL OR QR = '' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN DATE(CONVERT_TZ(created_at, '+00:00', '+09:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '+09:00')) THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN DATE(CONVERT_TZ(created_at, '+00:00', '+09:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '+09:00')) THEN COALESCE(CAST(cost AS UNSIGNED), 0) ELSE 0 END) as todayRevenue
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
        today: parseInt(stats.today),
        todayRevenue: parseInt(stats.todayRevenue) || 0
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

// eSIM URL 조회 API
app.get("/api/admin/esim-urls/:productOrderId", requireAuth, async (req, res) => {
  try {
    await mysqlClient.connect();
    
    const { productOrderId } = req.params;
    
    // user 테이블에서 snPin 조회
    const userQuery = `SELECT snPin FROM user WHERE productOrderId = ?`;
    const [userRows] = await mysqlClient.connection.execute(userQuery, [productOrderId]);
    
    if (userRows.length === 0) {
      return res.json({ urls: [] });
    }
    
    const snPinString = userRows[0].snPin;
    if (!snPinString) {
      return res.json({ urls: [] });
    }
    
    // snPin을 |로 분리
    const snPins = snPinString.split('|').map(pin => pin.trim()).filter(pin => pin);
    
    // 각 snPin에 대해 transId 조회
    const urls = [];
    for (const snPin of snPins) {
      const transIdQuery = `SELECT transId FROM esim_progress_notifications WHERE snPin = ?`;
      const [transIdRows] = await mysqlClient.connection.execute(transIdQuery, [snPin]);
      
      if (transIdRows.length > 0) {
        urls.push({
          snPin: snPin,
          transId: transIdRows[0].transId,
          url: `https://ringtalk.shop/esim/qr-detail?transId=${transIdRows[0].transId}`
        });
      }
    }
    
    res.json({ urls });
    
  } catch (error) {
    console.error('eSIM URL 조회 실패:', error);
    res.json({ urls: [] });
  } finally {
    await mysqlClient.disconnect();
  }
});

// 수동 발송 API
app.post("/api/admin/manual-dispatch", requireAuth, async (req, res) => {
  try {
    const { name, tel, product, days, quantity } = req.body;
    
    // 필수 필드 검증
    if (!name || !tel || !product || !days || !quantity) {
      return res.status(400).json({ 
        success: false, 
        message: '모든 필드를 입력해주세요.' 
      });
    }
    
    await mysqlClient.connect();
    
    // 수동 발송 데이터 삽입
    const insertQuery = `
      INSERT INTO user (
        productOrderId, orderId, ordererName, ordererTel, email, 
        productName, day, quantity, snPin, QR, created_at, kakaoSendYN, dispatchStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'N', 0)
    `;
    
    // 중복되지 않는 productOrderId 생성 (현재 시간 기반)
    const timestamp = Date.now();
    const uniqueProductOrderId = `manual_${timestamp}`;
    
    const [result] = await mysqlClient.connection.execute(insertQuery, [
      uniqueProductOrderId, // productOrderId
      'manual', // orderId
      name,     // ordererName
      tel,      // ordererTel
      'example@example.com', // email
      product,  // productName
      days,     // day
      quantity, // quantity
      null,     // snPin
      null      // QR
    ]);
    
    console.log(`수동 발송 데이터 저장 완료: ID=${result.insertId}`);
    
    res.json({
      success: true,
      message: '수동 발송 데이터가 성공적으로 저장되었습니다.',
      insertId: result.insertId
    });
    
  } catch (error) {
    console.error('수동 발송 데이터 저장 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '수동 발송 데이터 저장에 실패했습니다.',
      error: error.message 
    });
  } finally {
    await mysqlClient.disconnect();
  }
});

// 일별 매출 조회 API
app.get("/api/admin/daily-revenue", requireAuth, async (req, res) => {
  try {
    await mysqlClient.connect();
    
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
    }
    
    // 일별 매출 조회 쿼리 (한국시간 기준)
    const dailyRevenueQuery = `
      SELECT 
        DATE(CONVERT_TZ(created_at, '+00:00', '+09:00')) as date,
        COUNT(*) as orderCount,
        SUM(COALESCE(CAST(cost AS UNSIGNED), 0)) as dailyRevenue
      FROM user 
      WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+09:00')) BETWEEN ? AND ?
      GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '+09:00'))
      ORDER BY date DESC
    `;
    
    const [dailyRevenueRows] = await mysqlClient.connection.execute(dailyRevenueQuery, [startDate, endDate]);
    
    res.json({
      dailyRevenue: dailyRevenueRows,
      startDate,
      endDate,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('일별 매출 조회 실패:', error);
    res.status(500).json({ 
      error: '일별 매출 데이터를 불러오는데 실패했습니다.',
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
                <button class="manual-dispatch-btn" id="manualDispatchBtn">📦 수동 발송</button>
                <span class="user-info" id="userInfo">관리자</span>
                <button class="logout-btn" id="logoutBtn">로그아웃</button>
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
            <div class="stat-card revenue" id="revenueCard">
                <h3>오늘 매출</h3>
                <div class="number" id="todayRevenue">-</div>
                <small>당일 총 매출액 (클릭하여 일별 매출 확인)</small>
            </div>
        </div>
        
        <div class="controls">
            <button class="refresh-btn" id="refreshBtn">🔄 새로고침</button>
            <input type="text" class="search-box" id="searchBox" placeholder="주문번호, 고객명, 전화번호로 검색...">
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
                            <th>eSIM URL</th>
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
    
    <!-- 수동 발송 모달 -->
    <div id="manualDispatchModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📦 수동 발송</h2>
                <span class="close" id="closeManualDispatchModal">&times;</span>
            </div>
            <div class="modal-body">
                <form id="manualDispatchForm">
                    <div class="form-group">
                        <label for="manualName">이름 *</label>
                        <input type="text" id="manualName" name="name" required>
                    </div>
                    <div class="form-group">
                        <label for="manualTel">전화번호 *</label>
                        <input type="tel" id="manualTel" name="tel" required>
                    </div>
                    <div class="form-group">
                        <label for="manualProduct">상품명 *</label>
                        <input type="text" id="manualProduct" name="product" required>
                    </div>
                    <div class="form-group">
                        <label for="manualDays">일수 *</label>
                        <input type="number" id="manualDays" name="days" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="manualQuantity">수량 *</label>
                        <input type="number" id="manualQuantity" name="quantity" min="1" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn" id="cancelManualDispatch">취소</button>
                        <button type="submit" class="submit-btn" id="submitManualDispatch">전송</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <!-- 일별 매출 모달 -->
    <div id="dailyRevenueModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📈 일별 매출 현황</h2>
                <span class="close" id="closeModal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="date-range-selector">
                    <div class="date-input-group">
                        <label for="startDate">시작일:</label>
                        <input type="date" id="startDate" name="startDate">
                    </div>
                    <div class="date-input-group">
                        <label for="endDate">종료일:</label>
                        <input type="date" id="endDate" name="endDate">
                    </div>
                    <button class="search-btn" id="searchRevenueBtn">조회</button>
                </div>
                
                <div class="revenue-summary" id="revenueSummary" style="display: none;">
                    <div class="summary-card">
                        <h3>조회 기간 총 매출</h3>
                        <div class="summary-amount" id="totalRevenueAmount">-</div>
                    </div>
                    <div class="summary-card">
                        <h3>총 주문 건수</h3>
                        <div class="summary-count" id="totalOrderCount">-</div>
                    </div>
                </div>
                
                <div class="revenue-chart" id="revenueChart">
                    <div class="chart-placeholder">
                        날짜를 선택하고 조회 버튼을 클릭하세요
                    </div>
                </div>
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


