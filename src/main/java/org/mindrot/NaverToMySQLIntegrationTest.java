package org.mindrot;

import java.util.Arrays;
import java.util.List;

/**
 * 네이버 커머스 API와 MySQL 통합 테스트 클래스
 */
public class NaverToMySQLIntegrationTest {
    
    public static void main(String[] args) {
        System.out.println("=== 네이버 커머스 API → MySQL 통합 테스트 ===");
        
        try {
            // 1. MySQL 연결 테스트
            System.out.println("\n1. MySQL 연결 테스트...");
            boolean isConnected = UserOrderDAO.testConnection();
            if (!isConnected) {
                System.err.println("❌ MySQL 연결 실패! 설정을 확인해주세요.");
                System.err.println("Host: 140.245.70.121:3306");
                System.err.println("Database: ringtalk");
                System.err.println("User: dbeaver");
                return;
            }
            System.out.println("✅ MySQL 연결 성공!");
            
            // 2. 테스트 데이터로 OrderInfo 생성 및 저장 테스트
            System.out.println("\n2. 테스트 데이터 저장...");
            
            // 테스트용 OrderInfo 객체들 생성
            List<OrderInfo> testOrderInfos = Arrays.asList(
                new OrderInfo("TEST_ORDER_001", "ORDER_001", "테스트고객1", "010-1234-5678", 
                             "test1@example.com", 1, "[중국] 5G 매일 1기가 후 무제한", 1,
                             "현지 도착 날짜(ex : 2025.01.01): . / 이메일 (ex : ring@naver.com): test1@example.com / eSIM 데이터 사용량 선택: [중국] 5G 매일 1기가 후 무제한(저속) / 사용일수 선택: 1일"),
                new OrderInfo("TEST_ORDER_002", "ORDER_002", "테스트고객2", "010-2345-6789",
                             "test2@example.com", 3, "[일본] 5G 매일 2기가 후 무제한", 2,
                             "현지 도착 날짜(ex : 2025.01.01): . / 이메일 (ex : ring@naver.com): test2@example.com / eSIM 데이터 사용량 선택: [일본] 5G 매일 2기가 후 무제한(저속) / 사용일수 선택: 3일"),
                new OrderInfo("TEST_ORDER_003", "ORDER_003", "테스트고객3", "010-3456-7890",
                             "test3@example.com", 7, "[유럽] 5G 매일 1기가 후 무제한", 1,
                             "현지 도착 날짜(ex : 2025.01.01): . / 이메일 (ex : ring@naver.com): test3@example.com / eSIM 데이터 사용량 선택: [유럽] 5G 매일 1기가 후 무제한(저속) / 사용일수 선택: 7일")
            );
            
            // UserOrderDAO를 통해 저장
            UserOrderDAO.saveOrderInfos(testOrderInfos);
            
            // 3. 저장된 데이터 확인
            System.out.println("\n3. 저장된 데이터 확인...");
            for (OrderInfo orderInfo : testOrderInfos) {
                System.out.println("\n--- " + orderInfo.getProductOrderId() + " ---");
                UserOrderDAO.getUserByProductOrderId(orderInfo.getProductOrderId());
            }
            
            System.out.println("\n=== 통합 테스트 완료 ===");
            System.out.println("이제 NaverCommerceApiClient를 실행하면 API에서 가져온 주문 정보가 user 테이블에 자동으로 저장됩니다.");
            System.out.println("다음 필드들이 추출되어 저장됩니다:");
            System.out.println("- productOption에서 이메일 추출 → email 컬럼");
            System.out.println("- productOption에서 사용일수 추출 → day 컬럼");
            System.out.println("- productOption에서 eSIM 데이터 사용량 추출 → productName 컬럼");
            System.out.println("- quantity → quantity 컬럼");
            
        } catch (Exception e) {
            System.err.println("❌ 테스트 실행 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
