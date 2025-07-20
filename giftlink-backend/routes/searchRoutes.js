/*jshint esversion: 8 */

const express = require("express");
const router = express.Router();
const connectToDatabase = require("../models/db");

router.get("/", async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("gifts");
    let query = {};

    if (req.query.name && req.query.name.trim() !== "") {
      query.name = { $regex: req.query.name, $options: "i" }; // Using regex for partial match, case-insensitive
    }

    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.condition) {
      query.condition = req.query.condition;
    }
    if (req.query.age_years) {
      query.age_years = { $lte: parseInt(req.query.age_years) };
    }

    const gifts = await collection.find(query).toArray();
    res.json(gifts);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
