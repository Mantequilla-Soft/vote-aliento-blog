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

  // Calculate vote value using authentic blockchain data
  app.post("/api/calculate-vote", async (req, res) => {
    try {
      const { hivePower, votingPower = 10000, voteWeight = 10000 } = req.body;
      
      if (typeof hivePower !== 'number' || hivePower < 0) {
        return res.status(400).json({ 
          error: "Invalid Hive Power value",
          message: "Hive Power must be a non-negative number"
        });
      }

      // Fetch dynamic blockchain values from Hive API
      const blockchainResponse = await fetch("https://api.hive.blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "database_api.get_dynamic_global_properties",
          id: 1
        })
      });

      if (!blockchainResponse.ok) {
        throw new Error("Failed to fetch blockchain data");
      }

      const blockchainData = await blockchainResponse.json();
      
      if (!blockchainData.result) {
        throw new Error("Invalid blockchain API response");
      }

      const props = blockchainData.result;
      
      // Extract values from blockchain data
      const totalVestingFundHive = parseFloat(props.total_vesting_fund_hive.split(' ')[0]);
      const totalVestingShares = parseFloat(props.total_vesting_shares.split(' ')[0]);
      const rewardBalance = parseFloat(props.total_reward_fund_hive.split(' ')[0]);
      const recentClaims = parseFloat(props.recent_claims);

      // Get witness price feed for HIVE/HBD conversion
      const witnessResponse = await fetch("https://api.hive.blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "database_api.get_feed_history",
          id: 1
        })
      });

      let hiveToHbdRate = 1.0; // Default fallback
      if (witnessResponse.ok) {
        const witnessData = await witnessResponse.json();
        if (witnessData.result && witnessData.result.current_median_history) {
          const base = parseFloat(witnessData.result.current_median_history.base.split(' ')[0]);
          const quote = parseFloat(witnessData.result.current_median_history.quote.split(' ')[0]);
          hiveToHbdRate = base / quote; // HBD per HIVE
        }
      }

      // Helper functions for accurate vote calculation
      const hpToVests = (hp: number, totalVestingFundHive: number, totalVestingShares: number): number => {
        return hp * (totalVestingShares / totalVestingFundHive);
      };

      const calculateRshares = (vests: number, votingPower: number, voteWeight: number): number => {
        return (vests * votingPower * voteWeight) / (10000 * 10000);
      };

      const calculateVoteValue = (rshares: number, rewardBalance: number, recentClaims: number): number => {
        return (rshares / recentClaims) * rewardBalance;
      };

      const hiveToUsd = (hiveAmount: number, hiveToHbdRate: number): number => {
        // Convert HIVE to HBD first, then HBD is approximately $1 USD
        return hiveAmount * hiveToHbdRate;
      };

      // Perform the calculation
      const vests = hpToVests(hivePower, totalVestingFundHive, totalVestingShares);
      const rshares = calculateRshares(vests, votingPower, voteWeight);
      const voteValueHive = calculateVoteValue(rshares, rewardBalance, recentClaims);
      const voteValueUsd = hiveToUsd(voteValueHive, hiveToHbdRate);

      // Get current HIVE price for reference
      const priceResponse = await fetch(`${req.protocol}://${req.get('host')}/api/hive-price`);
      let currentPrice = 0.2; // Fallback
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        currentPrice = priceData.price;
      }

      res.json({
        hivePower,
        voteValueHive: parseFloat(voteValueHive.toFixed(6)),
        voteValueUsd: parseFloat(voteValueUsd.toFixed(6)),
        hivePrice: currentPrice,
        timestamp: new Date().toISOString(),
        blockchainData: {
          totalVestingFundHive,
          totalVestingShares,
          rewardBalance,
          recentClaims,
          hiveToHbdRate,
          vests: parseFloat(vests.toFixed(6)),
          rshares: parseFloat(rshares.toFixed(0))
        }
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
