import { useState, useEffect } from "react";
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

  // Calculate vote value mutation
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
    },
    onError: (error) => {
      toast({
        title: "Calculation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate vote value when Hive Power changes
  useEffect(() => {
    const hp = parseFloat(hivePower);
    if (hp > 0) {
      const timeoutId = setTimeout(() => {
        calculateMutation.mutate(hp);
      }, 300); // Debounce for 300ms
      
      return () => clearTimeout(timeoutId);
    } else {
      setCalculation(null);
    }
  }, [hivePower, calculateMutation]);



  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-hive-red to-red-600 text-white text-center">
            <h1 className="text-xl font-semibold">Hive Vote Calculator</h1>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Hive Power Input */}
            <div>
              <Label htmlFor="hivePower" className="text-sm font-medium text-gray-700 mb-2 block">
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
                  className="text-lg font-medium pr-12"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 font-medium">HP</span>
                </div>
              </div>
            </div>

            {/* Current HIVE Price */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Current HIVE Price</span>
                <div>
                  {priceLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-hive-red border-t-transparent"></div>
                  ) : priceError ? (
                    <span className="text-red-500 text-sm">Error</span>
                  ) : priceData ? (
                    <span className="text-lg font-semibold text-green-600">
                      ${priceData.price.toFixed(3)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Vote Value in USD */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 text-center">
              <p className="text-green-100 text-sm font-medium mb-2">Vote Value</p>
              <div className="text-3xl font-bold">
                {calculateMutation.isPending ? (
                  <div className="h-10 w-24 bg-green-400 rounded animate-pulse mx-auto" />
                ) : calculation ? (
                  `$${calculation.voteValueUsd.toFixed(3)}`
                ) : (
                  "$0.000"
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
