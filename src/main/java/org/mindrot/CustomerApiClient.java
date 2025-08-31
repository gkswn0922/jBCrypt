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
                System.out.println("\n사용자 처리 중...");
                
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
                orderRequest.productCode = getProductCode(user.getProductName(), user.getDay());
                orderRequest.quantity = user.getQuantity();
                
                // autoGraph 생성
                orderRequest.autoGraph = generateAutoGraph(orderRequest);
                
                // API 호출
                String response = sendOrderRequest(orderRequest);
                System.out.println("API 응답: " + response);
                
                // 응답에서 orderTid 추출 및 업데이트
                String newOrderTid = extractOrderTidFromResponse(response);
                System.out.println("=== 업데이트 정보 ===");
                System.out.println("추출된 newOrderTid: [" + newOrderTid + "]");
                System.out.println("사용자 이메일: [" + user.getEmail() + "]");
                
                if (newOrderTid != null && !newOrderTid.isEmpty()) {
                    System.out.println("API 응답에서 추출한 orderTid로 업데이트: " + newOrderTid);
                    updateUserOrderTid(user.getOrderId(), newOrderTid);
                    System.out.println("주문 ID " + user.getOrderId() + "의 orderTid가 " + newOrderTid + "로 업데이트되었습니다.");
                } else {
                    // 응답에서 orderTid를 못 찾았지만, 요청 시 생성한 orderTid를 사용
                    System.out.println("API 응답에서 orderTid 추출 실패, 요청 시 생성한 orderTid 사용: " + orderRequest.orderTid);
                    updateUserOrderTid(user.getOrderId(), orderRequest.orderTid);
                    System.out.println("주문 ID " + user.getOrderId() + "의 orderTid가 " + orderRequest.orderTid + "로 업데이트되었습니다.");
                }
                
                // API 호출 간격 조절 (너무 빠르게 호출하지 않도록)
                Thread.sleep(1000);
                
            } catch (Exception e) {
                System.err.println("사용자 처리 중 오류 발생: " + e.getMessage());
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
            String sql = "SELECT orderId, ordererName, ordererTel, email, quantity, productName, day FROM ringtalk.user WHERE orderTid IS NULL";
            
            try (PreparedStatement pstmt = conn.prepareStatement(sql);
                 ResultSet rs = pstmt.executeQuery()) {
                
                while (rs.next()) {
                    UserOrder user = new UserOrder();
                    user.setOrderId(rs.getString("orderId"));
                    user.setOrdererName(rs.getString("ordererName"));
                    user.setOrdererTel(rs.getString("ordererTel"));
                    user.setEmail(rs.getString("email"));
                    user.setQuantity(rs.getInt("quantity"));
                    user.setProductName(rs.getString("productName"));
                    user.setDay(rs.getInt("day"));
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
            System.out.println("=== 응답 디버깅 ===");
            System.out.println("전체 응답: " + response);
            
            // JSON 응답에서 orderTid 필드 추출
            if (response != null && response.contains("\"orderTid\"")) {
                // "orderTid":"20216-1820250830051732094683" 형태에서 추출
                int orderTidIndex = response.indexOf("\"orderTid\"");
                System.out.println("orderTid 인덱스: " + orderTidIndex);
                
                if (orderTidIndex >= 0) {  // >= 0으로 수정 (0도 유효한 인덱스)
                    int colonIndex = response.indexOf(":", orderTidIndex);
                    System.out.println("콜론 인덱스: " + colonIndex);
                    
                    if (colonIndex > 0) {
                        int valueStart = response.indexOf("\"", colonIndex) + 1;
                        System.out.println("값 시작 인덱스: " + valueStart);
                        
                        int valueEnd = response.indexOf("\"", valueStart);
                        System.out.println("값 끝 인덱스: " + valueEnd);
                        
                        if (valueEnd > valueStart) {
                            String orderTid = response.substring(valueStart, valueEnd);
                            System.out.println("추출된 orderTid: [" + orderTid + "]");
                            return orderTid;
                        }
                    }
                }
            } else {
                System.out.println("응답에서 orderTid를 찾을 수 없습니다.");
            }
        } catch (Exception e) {
            System.err.println("응답에서 orderTid 추출 중 오류: " + e.getMessage());
            e.printStackTrace();
        }
        System.out.println("orderTid 추출 실패");
        return null;
    }
    
    /**
     * 사용자의 orderTid를 데이터베이스에 업데이트 (orderId 기준)
     */
    private static void updateUserOrderTid(String orderId, String orderTid) {
        try (Connection conn = MySQLConfig.getConnection()) {
            String sql = "UPDATE ringtalk.user SET orderTid = ? WHERE orderId = ?";
            
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, orderTid);
                pstmt.setString(2, orderId);
                
                int affectedRows = pstmt.executeUpdate();
                if (affectedRows > 0) {
                    System.out.println("데이터베이스 업데이트 성공: orderId " + orderId);
                } else {
                    System.err.println("데이터베이스 업데이트 실패: orderId " + orderId + " - 해당 주문을 찾을 수 없습니다.");
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
     * @throws UnsupportedEncodingException 
     */
    private static String generateAutoGraph(OrderRequest request) throws NoSuchAlgorithmException, UnsupportedEncodingException {
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
        byte[] hashBytes = md.digest(data.getBytes(StandardCharsets.UTF_8.name()));
        
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
                byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8.name());
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
                new InputStreamReader(inputStream, StandardCharsets.UTF_8.name()))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line).append("\n");
            }
            return response.toString();
        }
    }

    /**
     * 베트남 상품명과 일수를 기반으로 productCode를 결정
     */
    private static String getProductCode(String productName, int day) {
        System.out.println("productName: " + productName);
        System.out.println("day: " + day);
        if (productName == null) return "eSIM-test";
        // 베트남 1기가 상품들
        if (productName.contains("1기가")) {
            switch (day) {
                case 1: return "eSIM-VN1G-01";
                case 2: return "eSIM-VN1G-03";
                case 3: return "eSIM-VN1G-03";
                case 4: return "eSIM-VN1G-05";
                case 5: return "eSIM-VN1G-05";
                case 6: return "eSIM-VN1G-07";
                case 7: return "eSIM-VN1G-07";
                case 8: return "eSIM-VN1G-10";
                case 9: return "eSIM-VN1G-10";
                case 10: return "eSIM-VN1G-10";
                case 15: return "eSIM-VN1G-15";
                case 20: return "eSIM-VN1G-20";
                case 30: return "eSIM-VN1G-30";
            }
        }
        
        // 베트남 3기가 상품들
        if (productName.contains("3기가")) {
            switch (day) {
                case 1: return "eSIM-VN3G-01";
                case 2: return "eSIM-VN3G-03";
                case 3: return "eSIM-VN3G-03";
                case 4: return "eSIM-VN3G-05";
                case 5: return "eSIM-VN3G-05";
                case 6: return "eSIM-VN3G-07";
                case 7: return "eSIM-VN3G-07";
                case 8: return "eSIM-VN3G-10";
                case 9: return "eSIM-VN3G-10";
                case 10: return "eSIM-VN3G-10";
                case 15: return "eSIM-VN3G-15";
                case 20: return "eSIM-VN3G-20";
                case 30: return "eSIM-VN3G-30";
            }
        }
        
        // 베트남 5기가 상품들 (VT5G)
        if (productName.contains("5기가") && productName.contains("종료")) {
            switch (day) {
                case 2: return "eSIM-VNVT5G-02";
                case 3: return "eSIM-VNVT5G-03";
                case 4: return "eSIM-VNVT5G-04";
                case 5: return "eSIM-VNVT5G-05";
                case 6: return "eSIM-VNVT5G-06";
                case 7: return "eSIM-VNVT5G-07";
                case 8: return "eSIM-VNVT5G-08";
                case 9: return "eSIM-VNVT5G-09";
                case 10: return "eSIM-VNVT5G-10";
                case 15: return "eSIM-VNVT5G-15";
                case 30: return "eSIM-VNVT5G-30";
            }
        }
        
        // 베트남 7기가 상품들 (VT7G)
        if (productName.contains("7기가") && productName.contains("종료")) {
            switch (day) {
                case 3: return "eSIM-VNVT7G-03";
                case 4: return "eSIM-VNVT7G-04";
                case 5: return "eSIM-VNVT7G-05";
                case 6: return "eSIM-VNVT7G-06";
                case 7: return "eSIM-VNVT7G-07";
                case 10: return "eSIM-VNVT7G-10";
                case 15: return "eSIM-VNVT7G-15";
                case 20: return "eSIM-VNVT7G-20";
                case 30: return "eSIM-VNVT7G-30";
            }
        }
        
        // 베트남 MAX 상품들 (무제한)
        if (productName.contains("MAX") || productName.contains("무제한")) {
            switch (day) {
                case 1: return "eSIM-VNMAX-01";
                case 3: return "eSIM-VNMAX-03";
                case 4: return "eSIM-VNMAX-05";
                case 5: return "eSIM-VNMAX-05";
                case 6: return "eSIM-VNMAX-07";
                case 7: return "eSIM-VNMAX-07";
                case 8: return "eSIM-VNMAX-10";
                case 9: return "eSIM-VNMAX-10";
                case 10: return "eSIM-VNMAX-10";
                case 15: return "eSIM-VNMAX-15";
                case 20: return "eSIM-VNMAX-20";
                case 30: return "eSIM-VNMAX-30";
            }
        }
        
        // 베트남 총 데이터 상품들 (T10G, T20G, T30G, T50G)
        if (productName.contains("총 10기가")) {
            switch (day) {
                case 3: return "eSIM-VNT10G-03";
                case 5: return "eSIM-VNT10G-05";
                case 7: return "eSIM-VNT10G-07";
                case 10: return "eSIM-VNT10G-10";
                case 15: return "eSIM-VNT10G-15";
                case 30: return "eSIM-VNT10G-30";
            }
        }
        
        if (productName.contains("총 20기가")) {
            switch (day) {
                case 3: return "eSIM-VNT20G-03";
                case 5: return "eSIM-VNT20G-05";
                case 7: return "eSIM-VNT20G-07";
                case 10: return "eSIM-VNT20G-10";
                case 15: return "eSIM-VNT20G-15";
                case 30: return "eSIM-VNT20G-30";
            }
        }
        
        if (productName.contains("총 30기가")) {
            switch (day) {
                case 3: return "eSIM-VNT30G-03";
                case 7: return "eSIM-VNT30G-07";
                case 10: return "eSIM-VNT30G-10";
                case 15: return "eSIM-VNT30G-15";
                case 30: return "eSIM-VNT30G-30";
            }
        }
        
        if (productName.contains("총 50기가")) {
            switch (day) {
                case 3: return "eSIM-VNT50G-03";
                case 5: return "eSIM-VNT50G-05";
                case 7: return "eSIM-VNT50G-07";
                case 15: return "eSIM-VNT50G-15";
                case 30: return "eSIM-VNT50G-30";
            }
        }
        
        // 매칭되지 않는 경우 기본값
        System.out.println("매칭되지 않는 상품: " + productName + " (일수: " + day + ")");
        return "eSIM-test";
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
