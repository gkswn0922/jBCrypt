import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { ipWhitelistMiddleware } from "./middlewares/security.js";
import { router as joytelRouter } from "./routes/joytel.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// IP 화이트리스트 (전역)
app.use(ipWhitelistMiddleware);

// JoyTel 라우트 마운트
app.use("/api/joytel", joytelRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: config.env });
});

app.listen(config.port, () => {
  console.log(`JoyTel server listening on port ${config.port}`);
});


