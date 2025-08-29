package org.mindrot;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class MySQLConfig {
    
    // MySQL 연결 정보
    private static final String DB_HOST = "140.245.70.121";
    private static final String DB_PORT = "3306";
    private static final String DB_NAME = "ringtalk";
    private static final String DB_USER = "dbeaver";
    private static final String DB_PASSWORD = "12345678";
    private static final String DB_URL;
    
    static {
        // MySQL JDBC URL 초기화
        DB_URL = String.format("jdbc:mysql://%s:%s/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul", 
                               DB_HOST, DB_PORT, DB_NAME);
        
        // MySQL JDBC 드라이버 로드 시도
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            System.out.println("MySQL JDBC 드라이버 로드 성공");
        } catch (ClassNotFoundException e) {
            System.err.println("MySQL JDBC 드라이버 로드 실패: " + e.getMessage());
            System.err.println("MySQL 연결이 작동하지 않을 수 있습니다.");
        }
    }
    
    /**
     * 데이터베이스 연결 가져오기
     */
    public static Connection getConnection() throws SQLException {
        try {
            return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
        } catch (SQLException e) {
            System.err.println("MySQL 연결 실패: " + e.getMessage());
            throw e;
        }
    }
    
    /**
     * 데이터소스 종료 (더 이상 필요 없음 - 개별 연결 관리)
     */
    public static void closeDataSource() {
        System.out.println("단순 JDBC 연결 - 별도의 데이터소스 종료 불필요");
    }
    
    /**
     * 연결 테스트
     */
    public static boolean testConnection() {
        try (Connection conn = getConnection()) {
            return conn != null && !conn.isClosed();
        } catch (SQLException e) {
            System.err.println("MySQL 연결 테스트 실패: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 연결 정보 출력
     */
    public static void printConnectionInfo() {
        System.out.println("=== MySQL 연결 정보 ===");
        System.out.println("Host: " + DB_HOST + ":" + DB_PORT);
        System.out.println("Database: " + DB_NAME);
        System.out.println("User: " + DB_USER);
        System.out.println("URL: " + DB_URL);
    }
}
