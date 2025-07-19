/*jshint esversion: 8 */

const express = require("express");
const router = express.Router();
const connectToDatabase = require("../models/db");
const logger = require("../logger");

router.get("/", async (req, res, next) => {
  logger.info("/ called");
  try {
    const db = await connectToDatabase();

    const collection = db.collection("gifts");
    const gifts = await collection.find({}).toArray();
    res.json(gifts);
  } catch (e) {
    logger.console.error("oops something went wrong", e);
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("gifts");
    const id = req.params.id;
    const gift = await collection.findOne({ id: id });

    if (!gift) {
      return res.status(404).send("Gift not found");
    }

    res.json(gift);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("gifts");
    const gift = await collection.insertOne(req.body);

    res.status(201).json(gift.ops[0]);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
