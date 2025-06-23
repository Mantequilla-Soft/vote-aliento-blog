import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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
      const response = await fetch("/api/calculate-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hivePower: hp }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to calculate vote value");
      }
      
      return response.json() as Promise<VoteCalculationResult>;
    },
    onSuccess: (data) => {
      setCalculation(data);
      // Cache the calculation result with HP as key
      queryClient.setQueryData(["/api/calculate-vote", data.hivePower], data);
    },
    onError: (error) => {
      toast({
        title: "Calculation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  // Calculate vote value when Hive Power changes with caching and debouncing
  const debouncedCalculate = useCallback((hp: number) => {
    // Check if we already have this calculation cached
    const cachedResult = queryClient.getQueryData(["/api/calculate-vote", hp]);
    if (cachedResult) {
      setCalculation(cachedResult as VoteCalculationResult);
      return;
    }
    
    calculateMutation.mutate(hp);
  }, [calculateMutation, queryClient]);

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
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white text-center">
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
              Built by{' '}
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
                <span className="text-sm font-medium text-slate-300">Current HIVE Price</span>
                <div>
                  {priceLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  ) : priceError ? (
                    <span className="text-red-400 text-sm">Error</span>
                  ) : priceData ? (
                    <span className="text-lg font-semibold text-blue-400">
                      ${priceData.price.toFixed(3)}
                    </span>
                  ) : null}
                </div>
              </div>
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
