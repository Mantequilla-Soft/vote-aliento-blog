import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

    // If all APIs fail, use a reasonable fallback
    if (!hivePrice) {
      hivePrice = 0.198;
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
    const { hivePower, votingPower = 10000, voteWeight = 10000, customPrice } = req.body;
    
    if (typeof hivePower !== 'number' || hivePower < 0) {
      return res.status(400).json({ 
        error: "Invalid Hive Power value",
        message: "Hive Power must be a non-negative number"
      });
    }

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

    const globalPropsData = await globalPropsResponse.json();
    const rewardFundData = await rewardFundResponse.json();

    if (!globalPropsData || globalPropsData.error) {
      throw new Error(`Global properties API error: ${globalPropsData?.error?.message || 'Unknown error'}`);
    }
    if (!rewardFundData || rewardFundData.error) {
      throw new Error(`Reward fund API error: ${rewardFundData?.error?.message || 'Unknown error'}`);
    }
    if (!globalPropsData.result || !rewardFundData.result) {
      throw new Error("Invalid blockchain data received - missing result fields");
    }

    const globalProps = globalPropsData.result;
    const rewardFund = rewardFundData.result;

    if (!globalProps.total_vesting_fund_hive || !globalProps.total_vesting_shares ||
        !rewardFund.reward_balance || !rewardFund.recent_claims) {
      throw new Error("Missing required blockchain parameters");
    }

    const totalVestingFundHive = parseFloat((globalProps.total_vesting_fund_hive || '0').toString().split(' ')[0]);
    const totalVestingShares = parseFloat((globalProps.total_vesting_shares || '0').toString().split(' ')[0]);
    const rewardBalance = parseFloat((rewardFund.reward_balance || '0').toString().split(' ')[0]);
    const recentClaims = parseFloat(rewardFund.recent_claims || '0');

    if (isNaN(totalVestingFundHive) || isNaN(totalVestingShares) || 
        isNaN(rewardBalance) || isNaN(recentClaims) ||
        totalVestingFundHive <= 0 || totalVestingShares <= 0 || 
        rewardBalance <= 0 || recentClaims <= 0) {
      throw new Error("Invalid blockchain parameter values");
    }

    let currentPrice = 0.20;
    
    if (customPrice && typeof customPrice === 'number' && customPrice > 0) {
      currentPrice = customPrice;
    } else {
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
    }

    const totalVests = (hivePower * totalVestingShares) / totalVestingFundHive;
    const voteStrength = Math.min(Math.max((votingPower || 10000) / 100, 0), 100);
    const voteWeightPercent = Math.min(Math.max((voteWeight || 10000) / 100, 0), 100);
    const votePowerFactor = (voteStrength / 100) * (voteWeightPercent / 100);
    
    const finalVest = totalVests * 1e6;
    const power = (votePowerFactor * 10000) / 50;
    const rshares = (power * finalVest) / 10000;
    
    const voteValueHive = (rshares / recentClaims) * rewardBalance;
    const voteValueUsd = voteValueHive * currentPrice;

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

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  console.error('Server error:', err);
});

export default app;
