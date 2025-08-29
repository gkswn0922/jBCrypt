package org.mindrot;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * MySQL 연결 테스트 클래스
 */
public class MySQLConnectionTest {
    
    public static void main(String[] args) {
        System.out.println("=== MySQL 연결 테스트 시작 ===");
        
        // 1. 기본 연결 테스트
        System.out.println("1. 기본 연결 테스트:");
        if (MySQLConfig.testConnection()) {
            System.out.println("✅ MySQL 연결 성공!");
        } else {
            System.out.println("❌ MySQL 연결 실패!");
            return;
        }
        
        // 2. 데이터베이스 정보 확인
        System.out.println("\n2. 데이터베이스 정보:");
        try (Connection conn = MySQLConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            
            // MySQL 버전 확인
            ResultSet rs = stmt.executeQuery("SELECT VERSION() as version");
            if (rs.next()) {
                System.out.println("MySQL 버전: " + rs.getString("version"));
            }
            
            // 현재 데이터베이스 확인
            rs = stmt.executeQuery("SELECT DATABASE() as db_name");
            if (rs.next()) {
                String dbName = rs.getString("db_name");
                System.out.println("현재 데이터베이스: " + (dbName != null ? dbName : "없음"));
            }
            
            // 테이블 목록 확인
            rs = stmt.executeQuery("SHOW TABLES");
            System.out.println("기존 테이블 목록:");
            while (rs.next()) {
                System.out.println("  - " + rs.getString(1));
            }
            
        } catch (Exception e) {
            System.err.println("데이터베이스 정보 조회 실패: " + e.getMessage());
        }
        
        // 3. 테이블 생성 테스트
        System.out.println("\n3. product_orders 테이블 생성 테스트:");
        try {
            ProductOrderDAO.createTableIfNotExists();
            System.out.println("✅ 테이블 생성/확인 완료!");
        } catch (Exception e) {
            System.err.println("❌ 테이블 생성 실패: " + e.getMessage());
        }
        
        // 4. 샘플 데이터 삽입 테스트
        System.out.println("\n4. 샘플 데이터 삽입 테스트:");
        ProductOrderInfo sampleOrder = createSampleOrder();
        boolean saved = ProductOrderDAO.saveOrUpdateProductOrder(sampleOrder);
        if (saved) {
            System.out.println("✅ 샘플 데이터 저장 성공!");
            
            // 저장된 데이터 조회 테스트
            ProductOrderInfo retrieved = ProductOrderDAO.getProductOrder(sampleOrder.productOrderId);
            if (retrieved != null) {
                System.out.println("✅ 데이터 조회 성공: " + retrieved.toString());
            } else {
                System.out.println("❌ 데이터 조회 실패");
            }
        } else {
            System.out.println("❌ 샘플 데이터 저장 실패!");
        }
        
        System.out.println("\n=== MySQL 연결 테스트 완료 ===");
        
        // 커넥션 풀 종료
        MySQLConfig.closeDataSource();
    }
    
    /**
     * 테스트용 샘플 주문 데이터 생성
     */
    private static ProductOrderInfo createSampleOrder() {
        ProductOrderInfo order = new ProductOrderInfo();
        order.productOrderId = "TEST" + System.currentTimeMillis();
        order.orderId = "ORDER" + System.currentTimeMillis();
        order.orderDate = java.time.LocalDateTime.now();
        order.customerName = "테스트고객";
        order.customerTel = "010-1234-5678";
        order.customerEmail = "test@example.com";
        order.productName = "테스트 eSIM 상품";
        order.productOption = "테스트 옵션";
        order.quantity = 1;
        order.unitPrice = new java.math.BigDecimal("10000");
        order.totalAmount = new java.math.BigDecimal("10000");
        order.paymentAmount = new java.math.BigDecimal("9500");
        order.orderStatus = "PAYED";
        order.deliveryStatus = "DELIVERY_COMPLETION";
        order.packageNumber = "PKG" + System.currentTimeMillis();
        
        return order;
    }
}
