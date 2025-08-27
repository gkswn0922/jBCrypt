import dotenv from "dotenv";

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),

  // IP 화이트리스트: 콤마로 분리된 리스트
  ipWhitelist: (process.env.JOYTEL_IP_WHITELIST || "").split(",").map(s => s.trim()).filter(Boolean),

  // Warehouse API
  warehouse: {
    baseURL: process.env.JOYTEL_WAREHOUSE_BASE_URL || "",
    customerCode: process.env.JOYTEL_WAREHOUSE_CUSTOMER_CODE || "",
    customerAuth: process.env.JOYTEL_WAREHOUSE_CUSTOMER_AUTH || "",
  },

  // RSP+ API
  rsp: {
    baseURL: process.env.JOYTEL_RSP_BASE_URL || "",
    appId: process.env.JOYTEL_RSP_APP_ID || "",
    appSecret: process.env.JOYTEL_RSP_APP_SECRET || "",
    notifyBaseURL: process.env.JOYTEL_RSP_NOTIFY_BASE_URL || "",
  },
};


