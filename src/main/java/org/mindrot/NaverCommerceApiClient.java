package org.mindrot;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class NaverCommerceApiClient {
    
    private static final String OAUTH_URL = "https://api.commerce.naver.com/external/v1/oauth2/token";
    private static final String ORDER_API_URL = "https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders";
    
    public static void main(String[] args) {
        try {
            // 1. SignatureGenerator로 필요한 값들 생성
            String clientId = "7gZetAuSj34sFFbx0Yj3OJ";
            String clientSecret = "$2a$04$wWsKI6s9oluIDTgYnP0Y0e";
            Long timestamp = System.currentTimeMillis();
            
            String signature = SignatureGenerator.generateSignature(clientId, clientSecret, timestamp);
            
            System.out.println("=== OAuth Token 발급 요청 ===");
            System.out.println("ClientId: " + clientId);
            System.out.println("Timestamp: " + timestamp);
            System.out.println("Signature: " + signature);
            System.out.println();
            
            // 2. OAuth 토큰 발급
            String accessToken = getAccessToken(clientId, timestamp, signature);
            
            if (accessToken != null) {
                System.out.println("Access Token 발급 성공: " + accessToken);
                System.out.println();
                
                // 3. 상품 주문 정보 조회
                String fromDate = "2025-08-23T14:35:42.613%2B09:00";
                List<String> productOrderIds = getProductOrderIds(accessToken, fromDate);
                
                // 4. productOrderId 배열 출력
                System.out.println("=== Product Order IDs ===");
                System.out.println("총 " + productOrderIds.size() + "개의 주문 발견:");
                System.out.println(Arrays.toString(productOrderIds.toArray()));
                
            } else {
                System.out.println("Access Token 발급 실패");
            }
            
        } catch (Exception e) {
            System.err.println("오류 발생: " + e.getMessage());
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
            
            System.out.println("OAuth 요청 바디: " + requestBody);
            
            // 요청 전송
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            // 응답 처리
            int responseCode = conn.getResponseCode();
            System.out.println("OAuth 응답 코드: " + responseCode);
            
            String response;
            if (responseCode == 200) {
                response = readResponse(conn.getInputStream());
            } else {
                response = readResponse(conn.getErrorStream());
                System.err.println("OAuth 오류 응답: " + response);
                return null;
            }
            
            System.out.println("OAuth 응답: " + response);
            
            // access_token 추출
            return extractAccessToken(response);
            
        } finally {
            conn.disconnect();
        }
    }
    
    /**
     * 상품 주문 정보를 조회하고 productOrderId 목록을 반환합니다.
     */
    private static List<String> getProductOrderIds(String accessToken, String fromDate) throws IOException {
        String urlWithParams = ORDER_API_URL + "?from=" + fromDate;
        URL url = new URL(urlWithParams);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        try {
            // 요청 설정
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            
            System.out.println("주문 조회 요청 URL: " + urlWithParams);
            
            // 응답 처리
            int responseCode = conn.getResponseCode();
            System.out.println("주문 조회 응답 코드: " + responseCode);
            
            String response;
            if (responseCode == 200) {
                response = readResponse(conn.getInputStream());
            } else {
                response = readResponse(conn.getErrorStream());
                System.err.println("주문 조회 오류 응답: " + response);
                return new ArrayList<>();
            }
            
            System.out.println("주문 조회 응답: " + response);
            
            // productOrderId 추출
            return extractProductOrderIds(response);
            
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
     * JSON 응답에서 productOrderId 목록을 추출합니다.
     */
    private static List<String> extractProductOrderIds(String jsonResponse) {
        List<String> productOrderIds = new ArrayList<>();
        
        // 간단한 정규식으로 productOrderId 추출
        Pattern pattern = Pattern.compile("\"productOrderId\"\\s*:\\s*\"([^\"]+)\"");
        Matcher matcher = pattern.matcher(jsonResponse);
        
        while (matcher.find()) {
            productOrderIds.add(matcher.group(1));
        }
        
        return productOrderIds;
    }
}

