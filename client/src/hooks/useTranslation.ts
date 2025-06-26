import { useState, useCallback } from 'react';
import { translations, Language, TranslationKey } from '@/lib/translations';

export function useTranslation() {
  const [language, setLanguage] = useState<Language>('en');

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] || translations.en[key];
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'en' ? 'es' : 'en');
  }, []);

  const setLang = useCallback((lang: Language) => {
    setLanguage(lang);
  }, []);

  return {
    language,
    t,
    toggleLanguage,
    setLanguage: setLang
  };
}