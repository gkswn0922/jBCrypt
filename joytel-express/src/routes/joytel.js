import express from "express";
import { submitEsimOrder } from "../clients/warehouseClient.js";
import { redeemCoupon, queryEsimStatusUsage } from "../clients/rspClient.js";
import { requireJsonContent } from "../middlewares/security.js";

export const router = express.Router();

// 1) eSIM Order Submit (Warehouse)
router.post("/esim/order", requireJsonContent, async (req, res) => {
  try {
    const result = await submitEsimOrder(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "eSIM order submit failed", error: err?.message || String(err) });
  }
});

// 2) eSIM Order Result Callback (snPin)
router.post("/esim/callback", requireJsonContent, async (req, res) => {
  try {
    const _payload = req.body;
    // TODO: 비즈니스 로직: DB 업데이트, 상태 변경, 로그 적재 등
    // 필요 시 JoyTel 서명 검증 로직 추가
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// 3) Coupon Redeem (RSP+)
router.post("/coupon/redeem", requireJsonContent, async (req, res) => {
  try {
    const result = await redeemCoupon(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "coupon redeem failed", error: err?.message || String(err) });
  }
});

// 4) Coupon Redeem Result Callback (QR code)
router.post("/notify/coupon/redeem", requireJsonContent, async (req, res) => {
  try {
    const _payload = req.body;
    // TODO: 비즈니스 로직: 쿠폰 상태 업데이트, QR 저장 등
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// 5) eSIM Status/Usage helper (RSP+)
router.post("/esim/status-usage", requireJsonContent, async (req, res) => {
  try {
    const result = await queryEsimStatusUsage(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "status/usage query failed", error: err?.message || String(err) });
  }
});


