import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, X } from "lucide-react";

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

  // Fetch current HIVE price
  const { data: priceData, isLoading: priceLoading, error: priceError } = useQuery<HivePriceData>({
    queryKey: ["/api/hive-price"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Calculate vote value mutation with query cache integration
  const calculateMutation = useMutation({
    mutationFn: async (hp: number) => {
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
    },
    onSuccess: (data) => {
      setCalculation(data);
      // Cache the calculation result with HP as key
      queryClient.setQueryData(["/api/calculate-vote", data.hivePower], data);
    },
    onError: (error) => {
      console.error("Vote calculation error:", error);
      toast({
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      // Clear calculation on error
      setCalculation(null);
    },
  });

  // Calculate vote value when Hive Power changes with caching and debouncing
  const debouncedCalculate = useCallback((hp: number) => {
    // Create cache key that includes custom price state
    const cacheKey = useCustomPrice ? 
      ["/api/calculate-vote", hp, "custom", customPrice] : 
      ["/api/calculate-vote", hp];
    
    const cachedResult = queryClient.getQueryData(cacheKey);
    if (cachedResult) {
      setCalculation(cachedResult as VoteCalculationResult);
      return;
    }
    
    calculateMutation.mutate(hp);
  }, [queryClient, calculateMutation, useCustomPrice, customPrice]);

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
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      return;
    }
    
    setUseCustomPrice(true);
    setIsEditingPrice(false);
    
    // Clear calculation cache to force recalculation with new price
    queryClient.removeQueries({ queryKey: ["/api/calculate-vote"] });
    
    toast({
      title: "Price Updated",
      description: `Using custom HIVE price: $${price.toFixed(3)}`,
    });
    
    // Recalculate with new price
    recalculateWithCurrentHP();
  }, [customPrice, toast, queryClient, recalculateWithCurrentHP]);

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
      title: "Price Reset",
      description: "Using live market price",
    });
    
    // Recalculate with market price
    recalculateWithCurrentHP();
  }, [toast, queryClient, recalculateWithCurrentHP]);

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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white text-center rounded-t-lg">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <img 
                src="/assets/image_1750717762447.png" 
                alt="Aliento Project Logo" 
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-xl font-semibold">Hive Upvote Calculator</h1>
            </div>
            <p className="text-blue-100 text-xs">
              Built by the {' '}
              <a 
                href="https://aliento.blog" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-200 hover:text-white underline transition-colors"
              >
                Aliento Project
              </a>
            </p>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Hive Power Input */}
            <div>
              <Label htmlFor="hivePower" className="text-sm font-medium text-slate-300 mb-2 block">
                Hive Power
              </Label>
              <div className="relative">
                <Input
                  id="hivePower"
                  type="number"
                  placeholder="Enter your HP"
                  value={hivePower}
                  onChange={(e) => setHivePower(e.target.value)}
                  min="0"
                  step="0.001"
                  className="text-lg font-medium pr-12 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-slate-400 font-medium">HP</span>
                </div>
              </div>
            </div>

            {/* Current HIVE Price */}
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-300">HIVE Price</span>
                  {useCustomPrice && (
                    <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">Custom</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {priceLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  ) : priceError ? (
                    <span className="text-red-400 text-sm">Error</span>
                  ) : isEditingPrice ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder="0.000"
                        min="0"
                        step="0.001"
                        className="w-20 h-8 text-sm text-center bg-slate-600 border-slate-500 text-white"
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
                        className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-slate-600"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-semibold text-blue-400">
                        ${useCustomPrice ? parseFloat(customPrice).toFixed(3) : (priceData?.price.toFixed(3) || "0.000")}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditPrice}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-slate-600"
                        title="Edit price"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {useCustomPrice && !isEditingPrice && (
                <div className="mt-2 pt-2 border-t border-slate-600">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Market: ${priceData?.price.toFixed(3) || "Loading..."}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleResetToMarket}
                      className="h-6 text-xs text-slate-400 hover:text-blue-400 hover:bg-slate-600 px-2"
                    >
                      Use Market Price
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Vote Value in USD */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg p-6 text-center shadow-lg">
              <p className="text-blue-100 text-sm font-medium mb-2">Vote Value</p>
              <div className="text-3xl font-bold min-h-[2.5rem] flex items-center justify-center">
                {calculateMutation.isPending ? (
                  <span className="inline-block h-8 w-20 bg-blue-500 rounded animate-pulse"></span>
                ) : calculation ? (
                  <span className="font-mono">${calculation.voteValueUsd.toFixed(3)}</span>
                ) : (
                  <span className="font-mono">$0.000</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
