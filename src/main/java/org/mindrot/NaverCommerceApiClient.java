package org.mindrot;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class NaverCommerceApiClient {
    
    private static final String OAUTH_URL = "https://api.commerce.naver.com/external/v1/oauth2/token";
    private static final String ORDER_API_URL = "https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders";
    
    public static void main(String[] args) {
        try {
            // 로그 파일 초기화
            initializeLogFile();
            
            log("=== Naver Commerce API 클라이언트 시작 ===");
            
            // 1. SignatureGenerator로 필요한 값들 생성
            String clientId = "7gZetAuSj34sFFbx0Yj3OJ";
            String clientSecret = "$2a$04$wWsKI6s9oluIDTgYnP0Y0e";
            Long timestamp = System.currentTimeMillis();
            
            String signature = SignatureGenerator.generateSignature(clientId, clientSecret, timestamp);
            
            log("=== OAuth Token 발급 요청 ===");
            log("ClientId: " + clientId);
            log("Timestamp: " + timestamp);
            log("Signature: " + signature);
            
            // 2. OAuth 토큰 발급
            String accessToken = getAccessToken(clientId, timestamp, signature);
            
            if (accessToken != null) {
                log("Access Token 발급 성공: " + accessToken);
                
                // 3. 상품 주문 정보 조회 (오늘 날짜로 설정)
                String fromDate = getYesterdayDateString();
                log("조회 시작 날짜: " + fromDate);
                
                List<OrderInfo> orderInfos = getProductOrderIds(accessToken, fromDate);
                
                // 4. 주문 정보 출력
                log("=== Order Information ===");
                log("총 " + orderInfos.size() + "개의 주문 발견:");
                for (OrderInfo orderInfo : orderInfos) {
                    log("주문 정보: " + orderInfo.toString());
                }
                
                // 5. MySQL에 주문 정보 저장
                if (!orderInfos.isEmpty()) {
                    log("=== MySQL 저장 시작 ===");
                    
                    // MySQL 연결 테스트
                    if (UserOrderDAO.testConnection()) {
                        log("MySQL 연결 성공");
                        
                        // user 테이블에 주문 정보 저장
                        UserOrderDAO.saveOrderInfos(orderInfos);
                        log("user 테이블에 주문 정보 저장 완료");
                        
                        // 저장된 데이터 확인 (첫 번째 항목만)
                        if (!orderInfos.isEmpty()) {
                            log("=== 저장 확인 ===");
                            UserOrderDAO.getUserByProductOrderId(orderInfos.get(0).getProductOrderId());
                        }
                    } else {
                        log("MySQL 연결 실패 - 데이터를 저장할 수 없습니다.");
                    }
                } else {
                    log("저장할 주문 데이터가 없습니다.");
                }
                
            } else {
                log("Access Token 발급 실패");
            }
            
            log("=== 프로그램 실행 완료 ===");
            
        } catch (Exception e) {
            log("오류 발생: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * OAuth 액세스 토큰을 발급받습니다.
     */
    private static String getAccessToken(String clientId, Long timestamp, String signature) throws IOException {
        URL url = new URL(OAUTH_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        try {
            // 요청 설정
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            
            // 요청 바디 구성
            String requestBody = String.format(
                "client_id=%s&timestamp=%d&grant_type=client_credentials&client_secret_sign=%s&type=SELF",
                URLEncoder.encode(clientId, StandardCharsets.UTF_8),
                timestamp,
                URLEncoder.encode(signature, StandardCharsets.UTF_8)
            );
            
            log("OAuth 요청 바디: " + requestBody);
            
            // 요청 전송
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            // 응답 처리
            int responseCode = conn.getResponseCode();
            log("OAuth 응답 코드: " + responseCode);
            
            String response;
            if (responseCode == 200) {
                response = readResponse(conn.getInputStream());
            } else {
                response = readResponse(conn.getErrorStream());
                log("OAuth 오류 응답: " + response);
                return null;
            }
            
            log("OAuth 응답: " + response);
            
            // access_token 추출
            return extractAccessToken(response);
            
        } finally {
            conn.disconnect();
        }
    }
    
    /**
     * 상품 주문 정보를 조회하고 productOrderId 목록을 반환합니다.
     */
    private static List<OrderInfo> getProductOrderIds(String accessToken, String fromDate) throws IOException {
        String urlWithParams = ORDER_API_URL + "?from=" + fromDate;
        URL url = new URL(urlWithParams);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        try {
            // 요청 설정
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            
            log("주문 조회 요청 URL: " + urlWithParams);
            
            // 응답 처리
            int responseCode = conn.getResponseCode();
            log("주문 조회 응답 코드: " + responseCode);
            
            String response;
            if (responseCode == 200) {
                response = readResponse(conn.getInputStream());
            } else {
                response = readResponse(conn.getErrorStream());
                log("주문 조회 오류 응답: " + response);
                return new ArrayList<>();
            }
            
            log("주문 조회 응답: " + response);
            
            // 주문 정보 추출
            return extractOrderInfos(response);
            
        } finally {
            conn.disconnect();
        }
    }
    
    /**
     * HTTP 응답을 문자열로 읽어옵니다.
     */
    private static String readResponse(InputStream inputStream) throws IOException {
        if (inputStream == null) return "";
        
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            return response.toString();
        }
    }
    
    /**
     * JSON 응답에서 access_token을 추출합니다.
     */
    private static String extractAccessToken(String jsonResponse) {
        // 간단한 정규식으로 access_token 추출
        Pattern pattern = Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"");
        Matcher matcher = pattern.matcher(jsonResponse);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }
    
    /**
     * JSON 응답에서 주문 정보를 추출합니다.
     */
    private static List<OrderInfo> extractOrderInfos(String jsonResponse) {
        List<OrderInfo> orderInfos = new ArrayList<>();
        
        // 전체 주문 블록을 찾기 위한 개선된 정규식
        Pattern orderPattern = Pattern.compile("\"productOrderId\"\\s*:\\s*\"([^\"]+)\".*?\"content\"\\s*:\\s*\\{(.*?)\\}\\s*\\}");
        Matcher orderMatcher = orderPattern.matcher(jsonResponse);
        
        while (orderMatcher.find()) {
            String productOrderId = orderMatcher.group(1);
            String contentBlock = orderMatcher.group(2);
            
            log("처리 중인 productOrderId: " + productOrderId);
            
            // order 블록에서 기본 정보 추출
            Pattern orderBlockPattern = Pattern.compile("\"order\"\\s*:\\s*\\{([^}]*?)\\}");
            Matcher orderBlockMatcher = orderBlockPattern.matcher(contentBlock);
            
            String orderId = productOrderId; // 기본값
            String ordererName = "고객_" + productOrderId.substring(0, Math.min(8, productOrderId.length()));
            String ordererTel = "0000000000";
            
            if (orderBlockMatcher.find()) {
                String orderContent = orderBlockMatcher.group(1);
                
                // orderId 추출
                String extractedOrderId = extractJsonValue(orderContent, "orderId");
                if (extractedOrderId != null && !extractedOrderId.isEmpty()) {
                    orderId = extractedOrderId;
                }
                
                // ordererName 추출
                String extractedOrdererName = extractJsonValue(orderContent, "ordererName");
                if (extractedOrdererName != null && !extractedOrdererName.isEmpty()) {
                    ordererName = extractedOrdererName;
                }
                
                // ordererTel 추출
                String extractedOrdererTel = extractJsonValue(orderContent, "ordererTel");
                if (extractedOrdererTel != null && !extractedOrdererTel.isEmpty()) {
                    ordererTel = extractedOrdererTel;
                }
            }
            
            // productOrder 블록에서 추가 정보 추출
            Pattern productOrderPattern = Pattern.compile("\"productOrder\"\\s*:\\s*\\{([^}]*?)\\}");
            Matcher productOrderMatcher = productOrderPattern.matcher(contentBlock);
            
            Integer quantity = 1; // 기본값
            String productOption = "";
            
            if (productOrderMatcher.find()) {
                String productOrderContent = productOrderMatcher.group(1);
                
                // quantity 추출
                String quantityStr = extractJsonValue(productOrderContent, "quantity");
                if (quantityStr != null && !quantityStr.isEmpty()) {
                    try {
                        quantity = Integer.parseInt(quantityStr);
                    } catch (NumberFormatException e) {
                        quantity = 1;
                    }
                }
                
                // productOption 추출
                String extractedProductOption = extractJsonValue(productOrderContent, "productOption");
                if (extractedProductOption != null) {
                    productOption = extractedProductOption;
                }
            }
            
            log("추출된 정보 - OrderId: " + orderId + ", Name: " + ordererName + ", Tel: " + ordererTel + ", Quantity: " + quantity);
            log("ProductOption: " + productOption);
            
            // 확장된 생성자로 OrderInfo 생성
            OrderInfo orderInfo = new OrderInfo(productOrderId, orderId, ordererName, ordererTel, 
                                               null, null, null, quantity, productOption);
            
            orderInfos.add(orderInfo);
        }
        
        return orderInfos;
    }
    
    /**
     * JSON 문자열에서 특정 키의 값을 추출합니다.
     */
    private static String extractJsonValue(String json, String key) {
        // 문자열 값 추출 (따옴표로 감싸진 값)
        Pattern stringPattern = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]+)\"");
        Matcher stringMatcher = stringPattern.matcher(json);
        if (stringMatcher.find()) {
            return stringMatcher.group(1);
        }
        
        // 숫자 값 추출 (따옴표 없는 값)
        Pattern numberPattern = Pattern.compile("\"" + key + "\"\\s*:\\s*([0-9]+)");
        Matcher numberMatcher = numberPattern.matcher(json);
        if (numberMatcher.find()) {
            return numberMatcher.group(1);
        }
        
        return null;
    }
    
    /**
     * 로그 파일을 초기화합니다.
     */
    private static void initializeLogFile() {
        try {
            String logFileName = "naver_commerce_api_" + getCurrentDateString() + ".log";
            File logFile = new File(logFileName);
            
            if (!logFile.exists()) {
                logFile.createNewFile();
                log("로그 파일 생성: " + logFileName);
            }
        } catch (IOException e) {
            System.err.println("로그 파일 초기화 실패: " + e.getMessage());
        }
    }
    
    /**
     * 로그를 파일과 콘솔에 기록합니다.
     */
    private static void log(String message) {
        String timestamp = getCurrentDateTimeString();
        String logMessage = "[" + timestamp + "] " + message;
        
        // 콘솔에 출력
        System.out.println(logMessage);
        
        // 파일에 기록
        try {
            String logFileName = "naver_commerce_api_" + getCurrentDateString() + ".log";
            try (FileWriter fw = new FileWriter(logFileName, true);
                 BufferedWriter bw = new BufferedWriter(fw);
                 PrintWriter out = new PrintWriter(bw)) {
                out.println(logMessage);
            }
        } catch (IOException e) {
            System.err.println("로그 파일 기록 실패: " + e.getMessage());
        }
    }
    
    /**
     * 현재 날짜를 문자열로 반환합니다 (YYYY-MM-DD).
     */
    private static String getCurrentDateString() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    }
    
    /**
     * 현재 날짜와 시간을 문자열로 반환합니다 (YYYY-MM-DD HH:mm:ss).
     */
    private static String getCurrentDateTimeString() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
    
    /**
     * 오늘 날짜를 네이버 API 형식으로 반환합니다.
     */
    private static String getTodayDateString() {
        LocalDateTime now = LocalDateTime.now();
        // 오늘 자정부터 시작
        LocalDateTime todayStart = now.toLocalDate().atStartOfDay();
        
        // ISO 8601 형식으로 변환하고 URL 인코딩
        String isoDate = todayStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS"));
        try {
            return URLEncoder.encode(isoDate + "+09:00", StandardCharsets.UTF_8);
        } catch (Exception e) {
            // 인코딩 실패 시 기본값 반환
            return "2025-01-27T00:00:00.000%2B09:00";
        }
    }

    private static String getYesterdayDateString() {
        LocalDateTime now = LocalDateTime.now();
        // 하루 전 자정부터 시작
        LocalDateTime yesterdayStart = now.toLocalDate().minusDays(1).atStartOfDay();
        
        // ISO 8601 형식으로 변환하고 URL 인코딩
        String isoDate = yesterdayStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS"));
        try {
            return URLEncoder.encode(isoDate + "+09:00", StandardCharsets.UTF_8);
        } catch (Exception e) {
            // 인코딩 실패 시 기본값 반환
            return "2025-01-26T00:00:00.000%2B09:00";
        }
    }
}

