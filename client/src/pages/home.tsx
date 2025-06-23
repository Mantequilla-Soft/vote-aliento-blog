import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Coins, DollarSign, TrendingUp, AlertCircle, Clock, Shield, ExternalLink, Info, Check } from "lucide-react";

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

const EXAMPLE_VALUES = [
  { hp: 100, label: "Small Account" },
  { hp: 1000, label: "Medium Account" },
  { hp: 10000, label: "Large Account" },
  { hp: 100000, label: "Whale Account" }
];

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
  }, [hivePower]);

  const handleExampleClick = (hp: number) => {
    setHivePower(hp.toString());
  };

  const formatLastUpdated = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return "--";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-hive-red rounded-lg flex items-center justify-center">
                <Calculator className="text-white" size={16} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-hive-grey">Hive Vote Calculator</h1>
                <p className="text-sm text-hive-accent hidden sm:block">Calculate your vote value in real-time</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-hive-accent">
                <ExternalLink className="text-hive-red" size={16} />
                <span>Powered by HAF Explorer</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Calculator Card */}
        <Card className="overflow-hidden shadow-lg">
          {/* Card Header */}
          <CardHeader className="bg-gradient-to-r from-hive-red to-red-600 text-white">
            <div className="flex items-center space-x-3">
              <Coins size={24} />
              <div>
                <h2 className="text-xl font-semibold">Vote Value Calculator</h2>
                <p className="text-red-100 text-sm">Enter your Hive Power to see your vote's worth</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Input Section */}
              <div className="space-y-6">
                <div>
                  <Label htmlFor="hivePower" className="text-sm font-medium text-hive-grey mb-2 block">
                    Hive Power (HP)
                  </Label>
                  <div className="relative">
                    <Input
                      id="hivePower"
                      type="number"
                      placeholder="Enter your Hive Power"
                      value={hivePower}
                      onChange={(e) => setHivePower(e.target.value)}
                      min="0"
                      step="0.001"
                      className="text-lg font-medium pr-12 focus:ring-hive-red focus:border-hive-red"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <span className="text-hive-accent font-medium">HP</span>
                    </div>
                  </div>
                  <p className="text-xs text-hive-accent mt-1 flex items-center">
                    <Info size={12} className="mr-1" />
                    Calculation assumes 100% vote weight and full voting mana
                  </p>
                </div>

                {/* Current Price Display */}
                <Card className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-hive-grey">Current HIVE Price</span>
                      <div className="flex items-center space-x-2">
                        {priceLoading ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-hive-red border-t-transparent"></div>
                            <span className="text-sm text-hive-accent">Loading...</span>
                          </div>
                        ) : priceError ? (
                          <div className="text-hive-error text-sm flex items-center">
                            <AlertCircle size={14} className="mr-1" />
                            Failed to load price
                          </div>
                        ) : priceData ? (
                          <div>
                            <span className="text-lg font-semibold text-hive-success">
                              ${priceData.price.toFixed(3)}
                            </span>
                            <span className="text-xs text-hive-accent ml-1">USD</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-xs text-hive-accent mt-1 flex items-center">
                      <Clock size={12} className="mr-1" />
                      <span>
                        Last updated: {priceData ? formatLastUpdated(priceData.timestamp) : "--"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Results Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-hive-grey flex items-center">
                  <TrendingUp className="text-hive-red mr-2" size={20} />
                  Vote Value
                </h3>

                {/* HIVE Value */}
                <Card className="bg-gradient-to-br from-hive-red to-red-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-100 text-sm font-medium">Vote Value (HIVE)</p>
                        <div className="text-2xl font-bold">
                          {calculateMutation.isPending ? (
                            <Skeleton className="h-8 w-20 bg-red-400" />
                          ) : calculation ? (
                            calculation.voteValueHive.toFixed(3)
                          ) : (
                            "0.000"
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Coins size={32} className="text-red-200" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* USD Value */}
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-medium">Vote Value (USD)</p>
                        <div className="text-2xl font-bold">
                          {calculateMutation.isPending ? (
                            <Skeleton className="h-8 w-20 bg-green-400" />
                          ) : calculation ? (
                            `$${calculation.voteValueUsd.toFixed(3)}`
                          ) : (
                            "$0.000"
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <DollarSign size={32} className="text-green-200" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Info */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="text-blue-500 mt-0.5" size={16} />
                      <div>
                        <p className="text-sm font-medium text-blue-800">How it's calculated</p>
                        <p className="text-xs text-blue-600 mt-1">
                          Vote value = (Your Vesting Shares / Total Network Vesting Shares) × Daily Reward Pool × Vote Weight / Daily Votes
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Example Values Section */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {EXAMPLE_VALUES.map((example) => (
            <Button
              key={example.hp}
              variant="outline"
              className="h-auto p-4 hover:shadow-md transition-shadow hover:border-hive-red"
              onClick={() => handleExampleClick(example.hp)}
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-hive-red">
                  {example.hp.toLocaleString()}
                </div>
                <div className="text-sm text-hive-accent">HP</div>
                <div className="text-xs text-gray-500 mt-1">{example.label}</div>
              </div>
            </Button>
          ))}
        </div>

        {/* Footer Info */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-hive-grey mb-3 flex items-center">
                  <Info className="text-hive-red mr-2" size={20} />
                  About This Calculator
                </h3>
                <ul className="space-y-2 text-sm text-hive-accent">
                  <li className="flex items-start">
                    <Check className="text-hive-success mr-2 mt-0.5" size={14} />
                    Real-time HIVE price from blockchain witness feeds
                  </li>
                  <li className="flex items-start">
                    <Check className="text-hive-success mr-2 mt-0.5" size={14} />
                    Simplified calculation assuming full voting mana
                  </li>
                  <li className="flex items-start">
                    <Check className="text-hive-success mr-2 mt-0.5" size={14} />
                    100% vote weight for maximum vote value
                  </li>
                  <li className="flex items-start">
                    <Check className="text-hive-success mr-2 mt-0.5" size={14} />
                    Uses actual Hive blockchain parameters for accurate estimates
                  </li>
                  <li className="flex items-start">
                    <Check className="text-hive-success mr-2 mt-0.5" size={14} />
                    Accounts for network voting power distribution
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-hive-grey mb-3 flex items-center">
                  <ExternalLink className="text-hive-red mr-2" size={20} />
                  Data Sources
                </h3>
                <div className="space-y-3">
                  <Card className="bg-gray-50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-hive-grey">HAF Explorer API</span>
                        <span className="text-xs text-hive-success bg-green-100 px-2 py-1 rounded-full">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-hive-accent mt-1">api.syncad.com</p>
                    </CardContent>
                  </Card>
                  <div className="text-xs text-hive-accent flex items-center">
                    <Shield className="text-hive-success mr-1" size={14} />
                    Powered by Hive Application Framework (HAF)
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
