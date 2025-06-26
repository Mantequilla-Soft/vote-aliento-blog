export const translations = {
  en: {
    title: "Hive Upvote Calculator",
    subtitle: "Built by the Aliento Project",
    hivePower: "Hive Power",
    hivePrice: "HIVE Price",
    voteValue: "Vote Value",
    custom: "Custom",
    market: "Market",
    useMarketPrice: "Use Market Price",
    editPrice: "Edit price",
    error: "Error",
    enterHP: "Enter HP to estimate vote value",
    loading: "Loading...",
    calculationFailed: "Calculation Failed",
    invalidPrice: "Invalid Price",
    invalidPriceDesc: "Please enter a valid price greater than 0",
    priceUpdated: "Price Updated",
    priceReset: "Price Reset",
    usingCustomPrice: "Using custom HIVE price",
    usingMarketPrice: "Using live market price",
    language: "Language",
    officialSite: "Official Website",
    witnessExplorer: "Witness Block Explorer"
  },
  es: {
    title: "Calculadora de Votos de Hive",
    subtitle: "Creado por el Proyecto Aliento",
    hivePower: "Hive Power",
    hivePrice: "Precio de HIVE",
    voteValue: "Valor del Voto",
    custom: "Personalizado",
    market: "Mercado",
    useMarketPrice: "Usar Precio de Mercado",
    editPrice: "Editar precio",
    error: "Error",
    enterHP: "Ingresa el HP para estimar el valor del voto",
    loading: "Cargando...",
    calculationFailed: "Cálculo Fallido",
    invalidPrice: "Precio Inválido",
    invalidPriceDesc: "Por favor ingresa un precio válido mayor a 0",
    priceUpdated: "Precio Actualizado",
    priceReset: "Precio Restablecido",
    usingCustomPrice: "Usando precio personalizado de HIVE",
    usingMarketPrice: "Usando precio de mercado en vivo",
    language: "Idioma",
    officialSite: "Sitio Oficial",
    witnessExplorer: "Explorador de Testigos"
  }
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;