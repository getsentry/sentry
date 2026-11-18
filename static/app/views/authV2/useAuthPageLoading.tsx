import {createContext, useContext, useLayoutEffect, useState} from 'react';

const AuthPageLoadingContext = createContext<(isLoading: boolean) => void>(() => {});

interface AuthPageLoadingProviderProps {
  children: (isLoading: boolean) => React.ReactNode;
}

export function AuthPageLoadingProvider({children}: AuthPageLoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <AuthPageLoadingContext value={setIsLoading}>
      {children(isLoading)}
    </AuthPageLoadingContext>
  );
}

export function useAuthPageLoading(isLoading: boolean) {
  const setIsLoading = useContext(AuthPageLoadingContext);

  useLayoutEffect(() => {
    setIsLoading(isLoading);

    return () => setIsLoading(true);
  }, [isLoading, setIsLoading]);
}
