package org.mindrot;

import java.sql.*;

/**
 * MySQL 데이터베이스 연결 테스트 클래스
 */
public class DBConnectionTest {
    
    private static final String DB_HOST = "140.245.70.121";
    private static final String DB_PORT = "3306";
    private static final String DB_NAME = "ringtalk";
    private static final String DB_USER = "dbeaver";
    private static final String DB_PASSWORD = "12345678";
    
    public static void main(String[] args) {
        System.out.println("=== MySQL 데이터베이스 연결 테스트 ===");
        System.out.println("Host: " + DB_HOST + ":" + DB_PORT);
        System.out.println("Database: " + DB_NAME);
        System.out.println("User: " + DB_USER);
        
        // 직접 JDBC URL로 연결 시도
        testDirectConnection();
    }
    
    private static void testDirectConnection() {
        System.out.println("\n--- 방법 1: 직접 JDBC 연결 테스트 ---");
        
        String jdbcUrl = "jdbc:mysql://" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME + 
                        "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul";
        
        try {
            // MySQL JDBC 드라이버 로드 시도
            System.out.println("1. MySQL JDBC 드라이버 로드 시도...");
            try {
                Class.forName("com.mysql.cj.jdbc.Driver");
                System.out.println("✅ MySQL JDBC 드라이버 로드 성공");
            } catch (ClassNotFoundException e) {
                System.out.println("❌ MySQL JDBC 드라이버 로드 실패: " + e.getMessage());
                System.out.println("   → MySQL Connector JAR 파일이 필요합니다.");
                return;
            }
            
            // 연결 시도
            System.out.println("2. 데이터베이스 연결 시도...");
            try (Connection conn = DriverManager.getConnection(jdbcUrl, DB_USER, DB_PASSWORD)) {
                System.out.println("✅ MySQL 연결 성공!");
                
                // 연결 정보 출력
                DatabaseMetaData metaData = conn.getMetaData();
                System.out.println("   데이터베이스 제품명: " + metaData.getDatabaseProductName());
                System.out.println("   데이터베이스 버전: " + metaData.getDatabaseProductVersion());
                System.out.println("   드라이버명: " + metaData.getDriverName());
                System.out.println("   드라이버 버전: " + metaData.getDriverVersion());
                
                // user 테이블 확인
                System.out.println("3. user 테이블 확인...");
                try (Statement stmt = conn.createStatement()) {
                    ResultSet rs = stmt.executeQuery("SHOW TABLES LIKE 'user'");
                    if (rs.next()) {
                        System.out.println("✅ user 테이블이 존재합니다.");
                        
                        // 테이블 구조 확인
                        System.out.println("4. user 테이블 구조 확인...");
                        ResultSet columns = stmt.executeQuery("DESCRIBE user");
                        System.out.println("   컬럼 목록:");
                        while (columns.next()) {
                            String columnName = columns.getString("Field");
                            String columnType = columns.getString("Type");
                            String isNull = columns.getString("Null");
                            String key = columns.getString("Key");
                            System.out.println("     - " + columnName + " (" + columnType + ") " + 
                                           (isNull.equals("YES") ? "NULL" : "NOT NULL") + 
                                           (key.equals("PRI") ? " [PRIMARY KEY]" : ""));
                        }
                    } else {
                        System.out.println("❌ user 테이블이 존재하지 않습니다.");
                    }
                }
                
            } catch (SQLException e) {
                System.err.println("❌ MySQL 연결 실패: " + e.getMessage());
                System.err.println("   SQL State: " + e.getSQLState());
                System.err.println("   Error Code: " + e.getErrorCode());
                
                // 일반적인 오류 원인 분석
                if (e.getErrorCode() == 0) {
                    System.err.println("   → 네트워크 연결 문제일 수 있습니다.");
                } else if (e.getErrorCode() == 1045) {
                    System.err.println("   → 사용자명/비밀번호가 잘못되었습니다.");
                } else if (e.getErrorCode() == 1049) {
                    System.err.println("   → 데이터베이스가 존재하지 않습니다.");
                } else if (e.getErrorCode() == 2003) {
                    System.err.println("   → MySQL 서버에 연결할 수 없습니다.");
                }
            }
            
        } catch (Exception e) {
            System.err.println("❌ 예상치 못한 오류: " + e.getMessage());
            e.printStackTrace();
        }
    }
    

}
