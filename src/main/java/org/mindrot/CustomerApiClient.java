package org.mindrot;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.sql.*;
import java.util.List;
import java.util.ArrayList;

/**
 * -주문 API 호출 클라이언트
 */
public class CustomerApiClient {
    
    private static final String API_URL = "https://api.joytelshop.com/customerApi/customerOrder";
    private static final String CUSTOMER_CODE = "20216-18";
    private static final String CUSTOMER_AUTH = "D6EE2E3555";
    private static final String WAREHOUSE = ""; // 빈 문자열
    
    public static void main(String[] args) {
        try {
            // 예제 주문 정보
            OrderRequest orderRequest = new OrderRequest();
            orderRequest.customerCode = CUSTOMER_CODE;
            orderRequest.orderTid = generateOrderTid(CUSTOMER_CODE);
            orderRequest.warehouse = "上海仓库";
            orderRequest.receiveName = "조피즈";
            orderRequest.phone = "01000000000";
            orderRequest.timestamp = getCurrentUnixTimestamp();
            orderRequest.email = "whgkswn0922@naver.com";
            orderRequest.type = 3;
            orderRequest.replyType = 1;
            orderRequest.productCode = "eSIM-test";
            orderRequest.quantity = 1;
            
            // autoGraph 생성
            orderRequest.autoGraph = generateAutoGraph(orderRequest);
            
            // API 호출
            String response = sendOrderRequest(orderRequest);
            System.out.println("API 응답: " + response);
            
            // 새로운 메서드: pending 주문들 처리
            System.out.println("\n=== Pending 주문들 처리 시작 ===");
            processPendingOrders();
            
        } catch (Exception e) {
            System.err.println("API 호출 실패: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * orderTid가 null인 사용자들을 가져와서 API 호출 후 orderTid 업데이트
     */
    public static void processPendingOrders() {
        List<UserOrder> pendingUsers = getPendingUsers();
        System.out.println("처리할 pending 주문 수: " + pendingUsers.size());
        
        for (UserOrder user : pendingUsers) {
            try {
                System.out.println("\n사용자 ID " + user.getId() + " 처리 중...");
                
                // API 호출을 위한 주문 요청 생성
                OrderRequest orderRequest = new OrderRequest();
                orderRequest.customerCode = CUSTOMER_CODE;
                orderRequest.orderTid = generateOrderTid(CUSTOMER_CODE);
                orderRequest.warehouse = "上海仓库";
                orderRequest.receiveName = user.getOrdererName();
                orderRequest.phone = "0" + user.getOrdererTel(); // 앞에 0 추가
                orderRequest.timestamp = getCurrentUnixTimestamp();
                orderRequest.email = user.getEmail();
                orderRequest.type = 3;
                orderRequest.replyType = 1;
                orderRequest.productCode = "eSIM-test";
                orderRequest.quantity = user.getQuantity();
                
                // autoGraph 생성
                orderRequest.autoGraph = generateAutoGraph(orderRequest);
                
                // API 호출
                String response = sendOrderRequest(orderRequest);
                System.out.println("API 응답: " + response);
                
                // 응답에서 orderTid 추출 및 업데이트
                String newOrderTid = extractOrderTidFromResponse(response);
                if (newOrderTid != null && !newOrderTid.isEmpty()) {
                    updateUserOrderTid(user.getId(), newOrderTid);
                    System.out.println("사용자 ID " + user.getId() + "의 orderTid가 " + newOrderTid + "로 업데이트되었습니다.");
                } else {
                    // 응답에서 orderTid를 못 찾았지만, 요청 시 생성한 orderTid를 사용
                    updateUserOrderTid(user.getId(), orderRequest.orderTid);
                    System.out.println("사용자 ID " + user.getId() + "의 orderTid가 " + orderRequest.orderTid + "로 업데이트되었습니다.");
                }
                
                // API 호출 간격 조절 (너무 빠르게 호출하지 않도록)
                Thread.sleep(1000);
                
            } catch (Exception e) {
                System.err.println("사용자 ID " + user.getId() + " 처리 중 오류 발생: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }
    
    /**
     * orderTid가 null인 사용자들을 데이터베이스에서 조회
     */
    private static List<UserOrder> getPendingUsers() {
        List<UserOrder> users = new ArrayList<>();
        
        try (Connection conn = MySQLConfig.getConnection()) {
            String sql = "SELECT id, ordererName, ordererTel, email, quantity FROM ringtalk.user WHERE orderTid IS NULL";
            
            try (PreparedStatement pstmt = conn.prepareStatement(sql);
                 ResultSet rs = pstmt.executeQuery()) {
                
                while (rs.next()) {
                    UserOrder user = new UserOrder();
                    user.setId(rs.getLong("id"));
                    user.setOrdererName(rs.getString("ordererName"));
                    user.setOrdererTel(rs.getString("ordererTel"));
                    user.setEmail(rs.getString("email"));
                    user.setQuantity(rs.getInt("quantity"));
                    users.add(user);
                }
            }
            
        } catch (SQLException e) {
            System.err.println("사용자 조회 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
        }
        
        return users;
    }
    
    /**
     * API 응답에서 orderTid 추출
     */
    private static String extractOrderTidFromResponse(String response) {
        try {
            // JSON 응답에서 orderTid 필드 추출
            if (response != null && response.contains("\"orderTid\"")) {
                int startIndex = response.indexOf("\"orderTid\"") + 12;
                int colonIndex = response.indexOf(":", startIndex);
                if (colonIndex > 0) {
                    int valueStart = response.indexOf("\"", colonIndex) + 1;
                    int valueEnd = response.indexOf("\"", valueStart);
                    if (valueEnd > valueStart) {
                        return response.substring(valueStart, valueEnd);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("응답에서 orderTid 추출 중 오류: " + e.getMessage());
        }
        return null;
    }
    
    /**
     * 사용자의 orderTid를 데이터베이스에 업데이트
     */
    private static void updateUserOrderTid(Long userId, String orderTid) {
        try (Connection conn = MySQLConfig.getConnection()) {
            String sql = "UPDATE ringtalk.user SET orderTid = ? WHERE id = ?";
            
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, orderTid);
                pstmt.setLong(2, userId);
                
                int affectedRows = pstmt.executeUpdate();
                if (affectedRows > 0) {
                    System.out.println("데이터베이스 업데이트 성공: 사용자 ID " + userId);
                } else {
                    System.err.println("데이터베이스 업데이트 실패: 사용자 ID " + userId + " - 해당 사용자를 찾을 수 없습니다.");
                }
            }
            
        } catch (SQLException e) {
            System.err.println("orderTid 업데이트 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * orderTid를 자동으로 생성합니다.
     * 형식: customerCode + yyyyMMddHHmmss + 6자리 랜덤 숫자
     */
    private static String generateOrderTid(String customerCode) {
        String timestamp = getCurrentTimestamp();
        String randomDigits = String.format("%06d", (int)(Math.random() * 1000000));
        return customerCode + timestamp + randomDigits;
    }
    /**
     * 현재 시간을 UNIX Epoch 밀리초(13자리)로 반환
     */
    private static Long getCurrentUnixTimestamp() {
        long currentTimeMillis = System.currentTimeMillis();
        return currentTimeMillis;
    }
    
    /**
     * 현재 시간을 YYYYMMDDHHMMSS 형식으로 반환 (orderTid 생성용)
     */
    private static String getCurrentTimestamp() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMddHHmmss");
        return sdf.format(new Date());
    }
    
    /**
     * autoGraph 해시값 생성
     */
    private static String generateAutoGraph(OrderRequest request) throws NoSuchAlgorithmException {
        // 올바른 순서: customerCode + customerAuth + warehouse + type + orderTid + receiveName + phone + timestamp + itemList(productCode + quantity)
        String data = request.customerCode + 
                     CUSTOMER_AUTH + 
                     WAREHOUSE + 
                     request.type + 
                     request.orderTid + 
                     request.receiveName + 
                     request.phone + 
                     request.timestamp + 
                     (request.productCode + request.quantity); // itemList를 하나의 그룹으로
        
        System.out.println("해시 대상 문자열: " + data);
        
        // SHA-1 해싱
        MessageDigest md = MessageDigest.getInstance("SHA-1");
        byte[] hashBytes = md.digest(data.getBytes(StandardCharsets.UTF_8));
        
        // 16진수 문자열로 변환
        StringBuilder sb = new StringBuilder();
        for (byte b : hashBytes) {
            sb.append(String.format("%02x", b));
        }
        
        String hash = sb.toString().toLowerCase();
        System.out.println("생성된 autoGraph: " + hash);
        
        return hash;
    }
    
    /**
     * API 요청 전송
     */
    public static String sendOrderRequest(OrderRequest request) throws IOException {
        URL url = new URL(API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        try {
            // 요청 설정
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            
            // JSON 요청 바디 생성
            String jsonBody = createJsonBody(request);
            System.out.println("요청 JSON: " + jsonBody);
            
            // 요청 전송
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            // 응답 처리
            int responseCode = conn.getResponseCode();
            System.out.println("응답 코드: " + responseCode);
            
            InputStream inputStream = (responseCode >= 200 && responseCode < 300) 
                ? conn.getInputStream() 
                : conn.getErrorStream();
                
            return readResponse(inputStream);
            
        } finally {
            conn.disconnect();
        }
    }
    
    /**
     * JSON 요청 바디 생성
     */
    private static String createJsonBody(OrderRequest request) {
        return "{\n" +
               "  \"customerCode\": \"" + request.customerCode + "\",\n" +
               "  \"orderTid\": \"" + request.orderTid + "\",\n" +
               "  \"receiveName\": \"" + request.receiveName + "\",\n" +
               "  \"phone\": \"" + request.phone + "\",\n" +
               "  \"timestamp\": \"" + request.timestamp + "\",\n" +
               "  \"email\": \"" + request.email + "\",\n" +
               "  \"type\": " + request.type + ",\n" +
               "  \"replyType\": " + request.replyType + ",\n" +
               "  \"itemList\": [\n" +
               "    {\n" +
               "      \"productCode\": \"" + request.productCode + "\",\n" +
               "      \"quantity\": " + request.quantity + "\n" +
               "    }\n" +
               "  ],\n" +
               "  \"autoGraph\": \"" + request.autoGraph + "\"\n" +
               "}";
    }
    
    /**
     * HTTP 응답을 문자열로 읽기
     */
    private static String readResponse(InputStream inputStream) throws IOException {
        if (inputStream == null) return "";
        
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line).append("\n");
            }
            return response.toString();
        }
    }
    
    /**
     * 주문 요청 정보를 담는 클래스
     */
    static class OrderRequest {
        String customerCode;
        String orderTid;
        String receiveName;
        String phone;
        Long timestamp;
        String email;
        int type;
        int replyType;
        String productCode;
        int quantity;
        String autoGraph;
        String warehouse;
    }
}
