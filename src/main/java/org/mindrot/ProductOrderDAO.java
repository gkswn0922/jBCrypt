package org.mindrot;

import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class ProductOrderDAO {
    
    /**
     * 테이블 생성 (최초 실행 시)
     */
    public static void createTableIfNotExists() {
        String createTableSQL = """
            CREATE TABLE IF NOT EXISTS product_orders (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                product_order_id VARCHAR(50) NOT NULL UNIQUE,
                order_id VARCHAR(50),
                order_date DATETIME,
                customer_name VARCHAR(100),
                customer_tel VARCHAR(20),
                customer_email VARCHAR(100),
                product_name VARCHAR(500),
                product_option TEXT,
                quantity INT,
                unit_price DECIMAL(10,2),
                total_amount DECIMAL(10,2),
                payment_amount DECIMAL(10,2),
                order_status VARCHAR(50),
                delivery_status VARCHAR(50),
                package_number VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_product_order_id (product_order_id),
                INDEX idx_order_date (order_date),
                INDEX idx_order_status (order_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """;
        
        try (Connection conn = MySQLConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            
            stmt.executeUpdate(createTableSQL);
            System.out.println("product_orders 테이블 확인/생성 완료");
            
        } catch (SQLException e) {
            System.err.println("테이블 생성 실패: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * ProductOrder 정보 저장/업데이트
     */
    public static boolean saveOrUpdateProductOrder(ProductOrderInfo orderInfo) {
        String insertSQL = """
            INSERT INTO product_orders (
                product_order_id, order_id, order_date, customer_name, customer_tel, 
                customer_email, product_name, product_option, quantity, unit_price, 
                total_amount, payment_amount, order_status, delivery_status, package_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                order_id = VALUES(order_id),
                order_date = VALUES(order_date),
                customer_name = VALUES(customer_name),
                customer_tel = VALUES(customer_tel),
                customer_email = VALUES(customer_email),
                product_name = VALUES(product_name),
                product_option = VALUES(product_option),
                quantity = VALUES(quantity),
                unit_price = VALUES(unit_price),
                total_amount = VALUES(total_amount),
                payment_amount = VALUES(payment_amount),
                order_status = VALUES(order_status),
                delivery_status = VALUES(delivery_status),
                package_number = VALUES(package_number),
                updated_at = CURRENT_TIMESTAMP
            """;
        
        try (Connection conn = MySQLConfig.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(insertSQL)) {
            
            pstmt.setString(1, orderInfo.productOrderId);
            pstmt.setString(2, orderInfo.orderId);
            pstmt.setTimestamp(3, orderInfo.orderDate != null ? Timestamp.valueOf(orderInfo.orderDate) : null);
            pstmt.setString(4, orderInfo.customerName);
            pstmt.setString(5, orderInfo.customerTel);
            pstmt.setString(6, orderInfo.customerEmail);
            pstmt.setString(7, orderInfo.productName);
            pstmt.setString(8, orderInfo.productOption);
            pstmt.setInt(9, orderInfo.quantity);
            pstmt.setBigDecimal(10, orderInfo.unitPrice);
            pstmt.setBigDecimal(11, orderInfo.totalAmount);
            pstmt.setBigDecimal(12, orderInfo.paymentAmount);
            pstmt.setString(13, orderInfo.orderStatus);
            pstmt.setString(14, orderInfo.deliveryStatus);
            pstmt.setString(15, orderInfo.packageNumber);
            
            int result = pstmt.executeUpdate();
            return result > 0;
            
        } catch (SQLException e) {
            System.err.println("주문 정보 저장 실패: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * 특정 ProductOrderId로 조회
     */
    public static ProductOrderInfo getProductOrder(String productOrderId) {
        String selectSQL = "SELECT * FROM product_orders WHERE product_order_id = ?";
        
        try (Connection conn = MySQLConfig.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(selectSQL)) {
            
            pstmt.setString(1, productOrderId);
            ResultSet rs = pstmt.executeQuery();
            
            if (rs.next()) {
                return mapResultSetToProductOrder(rs);
            }
            return null;
            
        } catch (SQLException e) {
            System.err.println("주문 정보 조회 실패: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * 전체 주문 목록 조회 (최신순)
     */
    public static List<ProductOrderInfo> getAllProductOrders(int limit) {
        String selectSQL = "SELECT * FROM product_orders ORDER BY created_at DESC LIMIT ?";
        List<ProductOrderInfo> orders = new ArrayList<>();
        
        try (Connection conn = MySQLConfig.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(selectSQL)) {
            
            pstmt.setInt(1, limit);
            ResultSet rs = pstmt.executeQuery();
            
            while (rs.next()) {
                orders.add(mapResultSetToProductOrder(rs));
            }
            
        } catch (SQLException e) {
            System.err.println("주문 목록 조회 실패: " + e.getMessage());
        }
        
        return orders;
    }
    
    /**
     * ResultSet을 ProductOrderInfo 객체로 매핑
     */
    private static ProductOrderInfo mapResultSetToProductOrder(ResultSet rs) throws SQLException {
        ProductOrderInfo order = new ProductOrderInfo();
        order.productOrderId = rs.getString("product_order_id");
        order.orderId = rs.getString("order_id");
        
        Timestamp timestamp = rs.getTimestamp("order_date");
        order.orderDate = timestamp != null ? timestamp.toLocalDateTime() : null;
        
        order.customerName = rs.getString("customer_name");
        order.customerTel = rs.getString("customer_tel");
        order.customerEmail = rs.getString("customer_email");
        order.productName = rs.getString("product_name");
        order.productOption = rs.getString("product_option");
        order.quantity = rs.getInt("quantity");
        order.unitPrice = rs.getBigDecimal("unit_price");
        order.totalAmount = rs.getBigDecimal("total_amount");
        order.paymentAmount = rs.getBigDecimal("payment_amount");
        order.orderStatus = rs.getString("order_status");
        order.deliveryStatus = rs.getString("delivery_status");
        order.packageNumber = rs.getString("package_number");
        
        return order;
    }
}
