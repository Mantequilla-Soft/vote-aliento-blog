import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current HIVE price from HAF Explorer API
  app.get("/api/hive-price", async (req, res) => {
    try {
      // Try to fetch from HAF Explorer API first
      let hivePrice = 0.234; // Fallback price
      
      try {
        // Fetch witness data to get price feeds
        const response = await fetch("https://api.syncad.com/hafbe-api/witnesses");
        
        if (response.ok) {
          const data = await response.json();
          
          // Extract price from witness data if available
          if (data && Array.isArray(data) && data.length > 0) {
            // Look for price feed data in witness information
            const witnessWithPrice = data.find((witness: any) => 
              witness.price_feed && witness.price_feed.base && witness.price_feed.quote
            );
            
            if (witnessWithPrice) {
              const base = parseFloat(witnessWithPrice.price_feed.base.split(' ')[0]);
              const quote = parseFloat(witnessWithPrice.price_feed.quote.split(' ')[0]);
              
              if (base > 0 && quote > 0) {
                hivePrice = base / quote;
              }
            }
          }
        }
      } catch (apiError) {
        console.warn("Failed to fetch from HAF Explorer, using fallback price:", apiError);
      }
      
      res.json({
        price: hivePrice,
        timestamp: new Date().toISOString(),
        source: "HAF Explorer API"
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

      // Simplified vote value calculation
      // This approximates the vote value based on Hive Power
      // Actual calculation involves complex reward pool mechanics
      const voteValueInHive = (hivePower * 0.02) / 50; // Simplified formula
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
