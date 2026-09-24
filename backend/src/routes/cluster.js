import { Router } from "express";
import { clusterAnalyzedPosts } from "../services/clustering.js";

const router = Router();

// POST /api/cluster
// request:  { posts: [ ...array of analyze responses... ] }
// response: { clusters: [ { clusterId, sharedIdentifier, posts: [...], combinedRiskScore } ] }
router.post("/", (req, res) => {
  const { posts } = req.body;

  if (!Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: "posts array is required and cannot be empty" });
  }

  try {
    const clusters = clusterAnalyzedPosts(posts);
    res.json({ clusters });
  } catch (err) {
    console.error("Clustering error:", err);
    res.status(500).json({ error: err.message || "Failed to cluster posts" });
  }
});

export default router;
