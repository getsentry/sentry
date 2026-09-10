import {createContext, useContext, useLayoutEffect, useState} from 'react';

const BrandedAuthLoadingContext = createContext<(isLoading: boolean) => void>(() => {});

interface BrandedAuthLoadingProviderProps {
  children: (isLoading: boolean) => React.ReactNode;
}

export function BrandedAuthLoadingProvider({children}: BrandedAuthLoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <BrandedAuthLoadingContext value={setIsLoading}>
      {children(isLoading)}
    </BrandedAuthLoadingContext>
  );
}

export function useBrandedAuthLoading(isLoading: boolean) {
  const setIsLoading = useContext(BrandedAuthLoadingContext);

  useLayoutEffect(() => {
    setIsLoading(isLoading);

    return () => setIsLoading(true);
  }, [isLoading, setIsLoading]);
}
