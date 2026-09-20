const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./src/models/user.model");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);

    const existingAdmin = await User.findOne({
      email: "admin@gmail.com",
    });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("123456", 10);

    const admin = await User.create({
      fullName: "BorderBound Admin",
      mobile: "9999999991",
      email: "admin@gmail.com",
      dob: new Date("1995-01-01"),
      gender: "other",
      city: "Dehradun",
      state: "Uttarakhand",
      password: hashedPassword,
      authProvider: "local",
      mobileVerified: true,
      role: "admin",
      status: "active",
    });

    console.log("Admin created successfully:", admin.email);

    process.exit(0);
  } catch (error) {
    console.error("Admin seed failed:", error);
    process.exit(1);
  }
};

seedAdmin();