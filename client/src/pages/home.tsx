import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/components/theme-provider";
import { Pencil, Check, X, Globe, Sun, Moon } from "lucide-react";

import logoalientosinfondo from "@assets/logoalientosinfondo.png";

interface HivePriceData {
  price: number;
  timestamp: string;
  source: string;
}

interface VoteCalculationResult {
  hivePower: number;
  voteValueHive: number;
  voteValueUsd: number;
  hivePrice: number;
  timestamp: string;
}



export default function Home() {
  const [hivePower, setHivePower] = useState<string>("");
  const [calculation, setCalculation] = useState<VoteCalculationResult | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState<string>("");
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language, toggleLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();

  // Fetch current HIVE price
  const { data: priceData, isLoading: priceLoading, error: priceError } = useQuery<HivePriceData>({
    queryKey: ["/api/hive-price"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Create a stable mutation function to prevent dependency issues
  const performCalculation = useCallback(async (hp: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const requestBody: any = { hivePower: hp };
      
      // Include custom price if user has set one
      if (useCustomPrice && customPrice) {
        const price = parseFloat(customPrice);
        if (!isNaN(price) && price > 0) {
          requestBody.customPrice = price;
        }
      }
      
      const response = await fetch("/api/calculate-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Network error" }));
        throw new Error(error.message || `HTTP ${response.status}: Failed to calculate vote value`);
      }
      
      return response.json() as Promise<VoteCalculationResult>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error("Calculation request timed out. Please try again.");
      }
      throw error;
    }
  }, [useCustomPrice, customPrice]);

  // Calculate vote value mutation with query cache integration
  const calculateMutation = useMutation({
    mutationFn: performCalculation,
    onSuccess: (data) => {
      setCalculation(data);
      // Cache the calculation result with HP as key
      queryClient.setQueryData(["/api/calculate-vote", data.hivePower], data);
    },
    onError: (error) => {
      console.error("Vote calculation error:", error);
      toast({
        title: t("calculationFailed"),
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      // Clear calculation on error
      setCalculation(null);
    },
  });
  
  // Calculate vote value when Hive Power changes with caching and debouncing
  const debouncedCalculate = useCallback((hp: number) => {
    // Only trigger new calculation if we don't have a result for this exact combination
    const currentPrice = useCustomPrice ? parseFloat(customPrice) : priceData?.price;
    
    if (calculation && 
        calculation.hivePower === hp && 
        currentPrice && 
        Math.abs(calculation.hivePrice - currentPrice) < 0.001) {
      return; // Skip calculation if we already have the right result
    }
    
    calculateMutation.mutate(hp);
  }, [calculation, useCustomPrice, customPrice, priceData?.price, calculateMutation]);

  // Helper function to recalculate with current HP
  const recalculateWithCurrentHP = useCallback(() => {
    const hp = parseFloat(hivePower);
    if (!isNaN(hp) && hp > 0) {
      debouncedCalculate(hp);
    }
  }, [hivePower, debouncedCalculate]);

  // Price editing handlers
  const handleEditPrice = useCallback(() => {
    const currentPrice = useCustomPrice ? customPrice : (priceData?.price.toString() || "");
    setCustomPrice(currentPrice);
    setIsEditingPrice(true);
  }, [useCustomPrice, customPrice, priceData?.price]);

  const handleSavePrice = useCallback(() => {
    const price = parseFloat(customPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: t("invalidPrice"),
        description: t("invalidPriceDesc"),
        variant: "destructive",
      });
      return;
    }
    
    setUseCustomPrice(true);
    setIsEditingPrice(false);
    
    // Clear calculation cache to force recalculation with new price
    queryClient.removeQueries({ queryKey: ["/api/calculate-vote"] });
    
    toast({
      title: t("priceUpdated"),
      description: `${t("usingCustomPrice")}: $${price.toFixed(3)}`,
    });
    
    // Recalculate with new price
    recalculateWithCurrentHP();
  }, [customPrice, toast, queryClient, recalculateWithCurrentHP, t]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingPrice(false);
    setCustomPrice("");
  }, []);

  const handleResetToMarket = useCallback(() => {
    setUseCustomPrice(false);
    setCustomPrice("");
    setIsEditingPrice(false);
    
    // Clear calculation cache to force recalculation with market price
    queryClient.removeQueries({ queryKey: ["/api/calculate-vote"] });
    
    toast({
      title: t("priceReset"),
      description: t("usingMarketPrice"),
    });
    
    // Recalculate with market price
    recalculateWithCurrentHP();
  }, [toast, queryClient, recalculateWithCurrentHP, t]);

  useEffect(() => {
    const hp = parseFloat(hivePower);
    if (hivePower.trim() === "" || isNaN(hp) || hp <= 0) {
      setCalculation(null);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      debouncedCalculate(hp);
    }, 800);
    
    return () => clearTimeout(timeoutId);
  }, [hivePower, debouncedCalculate]);



  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl bg-white dark:bg-card border-blue-200 dark:border-blue-200 dark:shadow-blue-500/10">
          <CardHeader className="card-gradient text-white text-center rounded-t-lg relative">
            <div className="absolute top-4 right-4 flex space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-8 w-8 p-0 text-blue-100 hover:text-white hover:bg-blue-600"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleLanguage}
                className="h-8 w-8 p-0 text-blue-100 hover:text-white hover:bg-blue-600"
                title={t("language")}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-center space-x-3 mb-2">
              <img 
                src={logoalientosinfondo} 
                alt="Aliento Project Logo" 
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-xl font-semibold">{t("title")}</h1>
            </div>
            <p className="text-blue-100 text-xs">
              {t("subtitle")}
            </p>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Hive Power Input */}
            <div>
              <Label htmlFor="hivePower" className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 block">
                {t("hivePower")}
              </Label>
              <div className="relative">
                <Input
                  id="hivePower"
                  type="number"
                  placeholder={t("enterHP")}
                  value={hivePower}
                  onChange={(e) => setHivePower(e.target.value)}
                  min="0"
                  step="0.001"
                  className="text-lg font-medium pr-12 bg-blue-50 dark:bg-blue-100 border-blue-200 dark:border-blue-200 text-blue-900 dark:text-blue-950 placeholder:text-blue-400 dark:placeholder:text-blue-400 focus:border-blue-500 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-blue-500 dark:text-blue-400 font-medium">HP</span>
                </div>
              </div>
            </div>

            {/* Current HIVE Price */}
            <div className="bg-blue-50 dark:bg-blue-100 border border-blue-200 dark:border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-800">{t("hivePrice")}</span>
                  {useCustomPrice && (
                    <span className="text-xs bg-blue-500 dark:bg-blue-700 text-white px-2 py-1 rounded">{t("custom")}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {priceLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  ) : priceError ? (
                    <span className="text-red-500 text-sm">{t("error")}</span>
                  ) : isEditingPrice ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder="0.000"
                        min="0"
                        step="0.001"
                        className="w-20 h-8 text-sm text-center bg-white dark:bg-blue-200 border-blue-300 dark:border-blue-300 text-blue-900 dark:text-blue-900"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSavePrice();
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSavePrice}
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-500 hover:bg-blue-100"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-blue-100"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-semibold text-blue-600 dark:text-blue-800">
                        ${useCustomPrice ? parseFloat(customPrice).toFixed(3) : (priceData?.price.toFixed(3) || "0.000")}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditPrice}
                        className="h-8 w-8 p-0 text-blue-500 dark:text-blue-700 hover:text-blue-600 dark:hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-200"
                        title={t("editPrice")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {useCustomPrice && !isEditingPrice && (
                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-600 dark:text-blue-400">
                      {t("market")}: ${priceData?.price.toFixed(3) || t("loading")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleResetToMarket}
                      className="h-6 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 px-2"
                    >
                      {t("useMarketPrice")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Vote Value in USD */}
            <div className="card-gradient text-white rounded-lg p-6 text-center shadow-lg">
              <p className="text-blue-100 text-sm font-medium mb-2">{t("voteValue")}</p>
              <div className="text-3xl font-bold min-h-[2.5rem] flex items-center justify-center">
                {calculateMutation.isPending ? (
                  <span className="inline-block h-8 w-20 bg-blue-400 rounded animate-pulse"></span>
                ) : calculation ? (
                  <span className="font-mono">${calculation.voteValueUsd.toFixed(3)}</span>
                ) : (
                  <span className="font-mono">$0.000</span>
                )}
              </div>
            </div>

            {/* Attribution Link */}
            <div className="text-center">
              <a 
                href="https://aliento.blog" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors font-medium text-xs"
              >
                 {t("officialSite")}
              </a>
              <br />
              <a 
                href="https://info.aliento.blog" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors font-medium text-xs"
              >
                {t("witnessExplorer")}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
