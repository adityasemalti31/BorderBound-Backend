const express = require("express");
const router = express.Router();
const { fetchPublicConfig } = require("../controllers/config.controller");

router.get("/public", fetchPublicConfig);

module.exports = router;
