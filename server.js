const app = require("./app");
const connectDB = require("./src/config/db");
const SystemConfig = require("./src/models/systemConfig.model");
require("dotenv").config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Ensure initial SystemConfig exists
    let config = await SystemConfig.findOne({ key: "DEFAULT_CONFIG" });
    if (!config) {
      config = await SystemConfig.create({ key: "DEFAULT_CONFIG" });
      console.log("Initialized default BorderBound system config.");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();