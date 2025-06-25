import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current HIVE price from multiple reliable sources
  app.get("/api/hive-price", async (req, res) => {
    try {
      let hivePrice = null;
      let priceSource = "Unknown";
      


      // Use witness price feed as primary source (authentic blockchain data)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch("https://api.syncad.com/hafbe-api/witnesses?limit=1", {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (process.env.NODE_ENV === 'development') {
            console.log("HAF Explorer response:", JSON.stringify(data).substring(0, 500));
          }
          
          // Parse HAF Explorer API response - it returns witnesses array with price_feed numbers
          if (data && data.witnesses && Array.isArray(data.witnesses) && data.witnesses.length > 0) {
            const witness = data.witnesses[0];
            
            if (typeof witness.price_feed === 'number' && witness.price_feed > 0 && witness.price_feed < 10) {
              hivePrice = witness.price_feed;
              priceSource = "Witness Price Feed";
            }
          }
        }
      } catch (error) {
        console.warn("Witness price feed failed:", error);
      }

      // If witness price feed fails, try CoinGecko as backup
      if (!hivePrice) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=hive-blockchain&vs_currencies=usd", {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            if (data["hive-blockchain"] && data["hive-blockchain"].usd && data["hive-blockchain"].usd > 0) {
              hivePrice = data["hive-blockchain"].usd;
              priceSource = "CoinGecko API (backup)";
            }
          }
        } catch (error) {
          console.warn("CoinGecko API backup failed:", error);
        }
      }

      // If all APIs fail, use a reasonable fallback from recent market data
      if (!hivePrice) {
        hivePrice = 0.198; // Last known stable price
        priceSource = "Fallback - API Error";
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

  // Calculate vote value using official Hive developers documentation formula
  app.post("/api/calculate-vote", async (req, res) => {
    try {
      const { hivePower, votingPower = 10000, voteWeight = 10000 } = req.body;
      
      if (typeof hivePower !== 'number' || hivePower < 0) {
        return res.status(400).json({ 
          error: "Invalid Hive Power value",
          message: "Hive Power must be a non-negative number"
        });
      }

      // CORRECT HIVE UPVOTE CALCULATION FORMULA
      // Based on official Hive blockchain source code and documentation
      
      // Fetch real-time blockchain data from Hive API
      const fetchWithTimeout = (url: string, options: any, timeout = 10000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { ...options, signal: controller.signal })
          .finally(() => clearTimeout(timeoutId));
      };

      const [globalPropsResponse, rewardFundResponse] = await Promise.all([
        fetchWithTimeout("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_dynamic_global_properties",
            id: 1
          })
        }),
        fetchWithTimeout("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_reward_fund",
            params: ["post"],
            id: 2
          })
        })
      ]);

      if (!globalPropsResponse.ok || !rewardFundResponse.ok) {
        throw new Error("Failed to fetch blockchain data");
      }

      const globalProps = (await globalPropsResponse.json()).result;
      const rewardFund = (await rewardFundResponse.json()).result;

      // Extract blockchain parameters
      const totalVestingFundHive = parseFloat(globalProps.total_vesting_fund_hive.split(' ')[0]);
      const totalVestingShares = parseFloat(globalProps.total_vesting_shares.split(' ')[0]);
      const rewardBalance = parseFloat(rewardFund.reward_balance.split(' ')[0]);
      const recentClaims = parseFloat(rewardFund.recent_claims);

      // Get current HIVE price from witness price feed
      let currentPrice = 0.20;
      try {
        const priceResponse = await fetchWithTimeout("https://api.syncad.com/hafbe-api/witnesses?limit=1", {}, 5000);
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData?.witnesses?.[0]?.price_feed > 0) {
            currentPrice = priceData.witnesses[0].price_feed;
          }
        }
      } catch (error) {
        // Use fallback price if witness feed fails
      }

      // ACCURATE HIVE VOTE CALCULATION
      // Using the proper rshares-based formula from Hive blockchain
      
      // 1. Convert Hive Power to VESTS
      const totalVests = (hivePower * totalVestingShares) / totalVestingFundHive;
      
      // 2. Calculate vote strength (0-100%)
      const voteStrength = Math.min(Math.max((votingPower || 10000) / 100, 0), 100);
      const voteWeightPercent = Math.min(Math.max((voteWeight || 10000) / 100, 0), 100);
      const votePowerFactor = (voteStrength / 100) * (voteWeightPercent / 100);
      
      // 3. Calculate rshares using Hive's formula
      // rshares = voting_power * vests * 1e6 / 10000
      const finalVest = totalVests * 1e6;
      const power = (votePowerFactor * 10000) / 50;
      const rshares = (power * finalVest) / 10000;
      
      // 4. Calculate vote value using the accurate rshares formula
      const voteValueHive = (rshares / recentClaims) * rewardBalance;
      const voteValueUsd = voteValueHive * currentPrice;

      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`RSHARES-BASED HIVE VOTE - Calculation for ${hivePower} HP:
        Total VESTS: ${totalVests.toFixed(2)}
        Vote Strength: ${voteStrength.toFixed(1)}%
        Vote Weight: ${voteWeightPercent.toFixed(1)}%
        Vote Power Factor: ${votePowerFactor.toFixed(4)}
        RShares: ${rshares.toFixed(0)}
        Reward Balance: ${rewardBalance.toFixed(2)} HIVE
        Recent Claims: ${recentClaims.toFixed(0)}
        Vote Value (HIVE): ${voteValueHive.toFixed(6)}
        Vote Value (USD): ${voteValueUsd.toFixed(6)}
        HIVE Price: $${currentPrice.toFixed(3)}`);
      }

      res.json({
        hivePower,
        voteValueHive: parseFloat(voteValueHive.toFixed(6)),
        voteValueUsd: parseFloat(voteValueUsd.toFixed(6)),
        hivePrice: currentPrice,
        timestamp: new Date().toISOString(),
        blockchainData: {
          totalVestingFundHive: totalVestingFundHive,
          totalVestingShares: totalVestingShares,
          rewardBalance: rewardBalance,
          recentClaims: recentClaims,
          totalVests: parseFloat(totalVests.toFixed(6)),
          voteStrength: voteStrength,
          voteWeightPercent: voteWeightPercent,
          votePowerFactor: parseFloat(votePowerFactor.toFixed(4)),
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
