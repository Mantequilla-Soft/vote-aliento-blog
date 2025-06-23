import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current HIVE price from multiple reliable sources
  app.get("/api/hive-price", async (req, res) => {
    try {
      let hivePrice = null;
      let priceSource = "Unknown";
      
      // Try multiple data sources in order of preference
      const priceSources = [
        {
          name: "Hive-Engine API",
          url: "https://api.hive-engine.com/rpc/contracts",
          method: "POST",
          body: {
            jsonrpc: "2.0",
            method: "find",
            params: {
              contract: "market",
              table: "metrics",
              query: {}
            },
            id: 1
          }
        },
        {
          name: "HiveSQL API",
          url: "https://api.hivesql.io/v1/global_props",
          method: "GET"
        },
        {
          name: "Hive Blog API",
          url: "https://api.hive.blog",
          method: "POST",
          body: {
            jsonrpc: "2.0",
            method: "database_api.get_dynamic_global_properties",
            id: 1
          }
        }
      ];

      // Try CoinGecko as primary source
      try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=hive-blockchain&vs_currencies=usd");
        if (response.ok) {
          const data = await response.json();
          if (data["hive-blockchain"] && data["hive-blockchain"].usd) {
            hivePrice = data["hive-blockchain"].usd;
            priceSource = "CoinGecko API";
          }
        }
      } catch (error) {
        console.warn("CoinGecko API failed:", error);
      }

      // If CoinGecko fails, try HAF Explorer with improved parsing
      if (!hivePrice) {
        try {
          const response = await fetch("https://api.syncad.com/hafbe-api/witnesses?limit=1");
          if (response.ok) {
            const data = await response.json();
            console.log("HAF Explorer response:", JSON.stringify(data).substring(0, 500));
            
            // Parse HAF Explorer API response - it returns witnesses array with price_feed numbers
            if (data && data.witnesses && Array.isArray(data.witnesses) && data.witnesses.length > 0) {
              const witness = data.witnesses[0];
              
              if (typeof witness.price_feed === 'number' && witness.price_feed > 0) {
                hivePrice = witness.price_feed;
                priceSource = "HAF Explorer API";
              }
            }
          }
        } catch (error) {
          console.warn("HAF Explorer API failed:", error);
        }
      }

      // Final fallback to a reasonable estimate if all APIs fail
      if (!hivePrice) {
        hivePrice = 0.25; // Conservative estimate
        priceSource = "Fallback estimate";
        console.warn("All price APIs failed, using fallback price");
      }
      
      res.json({
        price: parseFloat(hivePrice.toFixed(6)),
        timestamp: new Date().toISOString(),
        source: priceSource
      });
    } catch (error) {
      console.error("Error fetching HIVE price:", error);
      res.status(500).json({ 
        error: "Failed to fetch HIVE price",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Calculate vote value
  app.post("/api/calculate-vote", async (req, res) => {
    try {
      const { hivePower } = req.body;
      
      if (typeof hivePower !== 'number' || hivePower < 0) {
        return res.status(400).json({ 
          error: "Invalid Hive Power value",
          message: "Hive Power must be a non-negative number"
        });
      }

      // Get current HIVE price
      const priceResponse = await fetch(`${req.protocol}://${req.get('host')}/api/hive-price`);
      
      if (!priceResponse.ok) {
        throw new Error("Failed to fetch current HIVE price");
      }
      
      const priceData = await priceResponse.json();
      const currentPrice = priceData.price;

      // More accurate vote value calculation based on Hive blockchain mechanics
      // This calculation approximates the real Hive vote value formula
      
      // Key parameters (approximate values based on current Hive network)
      const REWARD_POOL_TOTAL = 950000; // Approximate daily reward pool in HIVE
      const TOTAL_VESTING_SHARES = 430000000000; // Approximate total vesting shares
      const VOTES_PER_DAY = 15000000; // Approximate daily votes
      const VOTE_WEIGHT = 1.0; // 100% vote weight
      const VOTING_MANA = 1.0; // 100% voting mana
      
      // Convert Hive Power to Vesting Shares (approximately 1 HP = ~2000 vesting shares)
      const vestingShares = hivePower * 2000;
      
      // Calculate voting power as percentage of total network voting power
      const votingPowerPercentage = vestingShares / TOTAL_VESTING_SHARES;
      
      // Calculate share of daily reward pool
      const dailyRewardShare = (REWARD_POOL_TOTAL * votingPowerPercentage * VOTE_WEIGHT * VOTING_MANA);
      
      // Approximate vote value (assuming this vote gets a proportional share)
      // Adjusted by average votes per day to get per-vote value
      const voteValueInHive = dailyRewardShare / VOTES_PER_DAY;
      const voteValueInUsd = voteValueInHive * currentPrice;

      res.json({
        hivePower,
        voteValueHive: parseFloat(voteValueInHive.toFixed(6)),
        voteValueUsd: parseFloat(voteValueInUsd.toFixed(6)),
        hivePrice: currentPrice,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error calculating vote value:", error);
      res.status(500).json({ 
        error: "Failed to calculate vote value",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
