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
            priceSource = "CoinGecko API";
          }
        }
      } catch (error) {
        console.warn("CoinGecko API failed:", error);
      }

      // If CoinGecko fails, try HAF Explorer with improved parsing
      if (!hivePrice) {
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
                priceSource = "HAF Explorer API";
              }
            }
          }
        } catch (error) {
          console.warn("HAF Explorer API failed:", error);
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

      // Fetch all required data in parallel for efficiency
      const [rewardFundResponse, feedHistoryResponse, globalPropsResponse] = await Promise.all([
        fetch("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_reward_fund",
            params: ["post"],
            id: 1
          })
        }),
        fetch("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_feed_history",
            id: 2
          })
        }),
        fetch("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_dynamic_global_properties",
            id: 3
          })
        })
      ]);

      // Parse reward fund data
      const rewardFundData = await rewardFundResponse.json();
      const rewardFund = rewardFundData.result;
      const rewardBalance = parseFloat(rewardFund.reward_balance.split(' ')[0]);
      const recentClaims = parseFloat(rewardFund.recent_claims);

      // Parse feed history data for HBD median price
      let hbdMedianPrice = 0.192; // Current typical value
      try {
        const feedData = await feedHistoryResponse.json();
        if (feedData.result?.current_median_history) {
          const base = parseFloat(feedData.result.current_median_history.base.split(' ')[0]);
          const quote = parseFloat(feedData.result.current_median_history.quote.split(' ')[0]);
          hbdMedianPrice = base / quote;
        }
      } catch (error) {
        console.log("Using fallback HBD median price:", hbdMedianPrice);
      }

      // Parse global properties for vesting data
      const globalPropsData = await globalPropsResponse.json();
      const props = globalPropsData.result;
      
      let totalVestingFundHive, totalVestingShares;
      if (typeof props.total_vesting_fund_hive === 'string') {
        totalVestingFundHive = parseFloat(props.total_vesting_fund_hive.split(' ')[0]);
        totalVestingShares = parseFloat(props.total_vesting_shares.split(' ')[0]);
      } else {
        totalVestingFundHive = parseFloat(props.total_vesting_fund_hive.amount) / Math.pow(10, props.total_vesting_fund_hive.precision);
        totalVestingShares = parseFloat(props.total_vesting_shares.amount) / Math.pow(10, props.total_vesting_shares.precision);
      }

      // Get current HIVE price for USD conversion
      let currentPrice = 0.198;
      try {
        const priceResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=hive-blockchain&vs_currencies=usd", {
          signal: AbortSignal.timeout(3000)
        });
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData["hive-blockchain"]?.usd > 0) {
            currentPrice = priceData["hive-blockchain"].usd;
          }
        }
      } catch (error) {
        // Use HAF Explorer as backup
        try {
          const hafResponse = await fetch("https://api.syncad.com/hafbe-api/witnesses?limit=1", {
            signal: AbortSignal.timeout(3000)
          });
          if (hafResponse.ok) {
            const hafData = await hafResponse.json();
            if (hafData?.witnesses?.[0]?.price_feed > 0 && hafData.witnesses[0].price_feed < 10) {
              currentPrice = hafData.witnesses[0].price_feed;
            }
          }
        } catch (hafError) {
          // Use fallback price
        }
      }

      // Official Hive Developers Formula (https://developers.hive.io/tutorials-recipes/estimate_upvote.html)
      // total_vests = vesting_shares + received_vesting_shares - delegated_vesting_shares
      const totalVests = (hivePower * totalVestingShares) / totalVestingFundHive;
      
      // final_vest = total_vests * 1e6
      const finalVest = totalVests * 1e6;
      
      // power = (voting_power * weight / 10000) / 50
      const power = (votingPower * voteWeight / 10000) / 50;
      
      // rshares = power * final_vest / 10000
      const rshares = power * finalVest / 10000;
      
      // estimate = rshares / recent_claims * reward_balance * hbd_median_price
      const voteValueHive = (rshares / recentClaims) * rewardBalance * hbdMedianPrice;
      const voteValueUsd = voteValueHive * currentPrice;

      // Log calculation for debugging
      if (process.env.NODE_ENV === 'development' && hivePower > 1000) {
        console.log(`Official Hive formula for ${hivePower} HP:
        Total vests: ${totalVests.toFixed(6)}
        Final vest: ${finalVest.toFixed(0)}
        Power: ${power.toFixed(6)}
        RShares: ${rshares.toFixed(0)}
        Vote value (HIVE): ${voteValueHive.toFixed(6)}
        Vote value (USD): ${voteValueUsd.toFixed(6)}
        HBD median: ${hbdMedianPrice.toFixed(3)}
        HIVE price: $${currentPrice}`);
      }

      res.json({
        hivePower,
        voteValueHive: parseFloat(voteValueHive.toFixed(6)),
        voteValueUsd: parseFloat(voteValueUsd.toFixed(6)),
        hivePrice: currentPrice,
        timestamp: new Date().toISOString(),
        blockchainData: {
          totalVestingFundHive: parseFloat(totalVestingFundHive.toFixed(3)),
          totalVestingShares: parseFloat(totalVestingShares.toFixed(0)),
          rewardBalance: parseFloat(rewardBalance.toFixed(2)),
          recentClaims: parseFloat(recentClaims.toFixed(0)),
          totalVests: parseFloat(totalVests.toFixed(6)),
          finalVest: parseFloat(finalVest.toFixed(0)),
          power: parseFloat(power.toFixed(6)),
          rshares: parseFloat(rshares.toFixed(0)),
          hbdMedianPrice: parseFloat(hbdMedianPrice.toFixed(3))
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
