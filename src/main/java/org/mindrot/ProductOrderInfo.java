package org.mindrot;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 네이버 커머스 주문 정보를 담는 데이터 클래스
 */
public class ProductOrderInfo {
    public String productOrderId;      // 상품주문번호 (Primary Key)
    public String orderId;             // 주문번호
    public LocalDateTime orderDate;    // 주문일시
    public String customerName;        // 주문자명
    public String customerTel;         // 주문자 전화번호
    public String customerEmail;       // 주문자 이메일 (옵션에서 추출)
    public String productName;         // 상품명
    public String productOption;       // 상품옵션
    public int quantity;               // 수량
    public BigDecimal unitPrice;       // 단가
    public BigDecimal totalAmount;     // 총 상품금액
    public BigDecimal paymentAmount;   // 실제 결제금액
    public String orderStatus;         // 주문상태
    public String deliveryStatus;      // 배송상태
    public String packageNumber;       // 발송번호
    
    public ProductOrderInfo() {}
    
    @Override
    public String toString() {
        return String.format("ProductOrder{id='%s', orderId='%s', customer='%s', product='%s', status='%s'}", 
                           productOrderId, orderId, customerName, productName, orderStatus);
    }
}
