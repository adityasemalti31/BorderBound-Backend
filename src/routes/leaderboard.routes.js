const express = require("express");
const router = express.Router();
const { fetchLeaderboard } = require("../controllers/leaderboard.controller");

router.get("/", fetchLeaderboard);

module.exports = router;
