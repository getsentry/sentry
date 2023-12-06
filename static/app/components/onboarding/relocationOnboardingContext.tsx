import {createContext, useCallback} from 'react';

import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Data = {
  formData?: FormData;
};

export type RelocationOnboardingContextProps = {
  data: Data;
  setData: (data: Data) => void;
};

export const RelocationOnboardingContext =
  createContext<RelocationOnboardingContextProps>({
    data: {
      formData: undefined,
    },
    setData: () => {},
  });

type ProviderProps = {
  children: React.ReactNode;
  value?: FormData;
};

export function RelocationOnboardingContextProvider({children, value}: ProviderProps) {
  const [sessionStorage, setSessionStorage] = useSessionStorage<Data>(
    'relocationOnboarding',
    {
      formData: value,
    }
  );

  const setData = useCallback(
    (data: Data) => {
      setSessionStorage(data);
    },
    [setSessionStorage]
  );

  return (
    <RelocationOnboardingContext.Provider
      value={{
        data: sessionStorage,
        setData,
      }}
    >
      {children}
    </RelocationOnboardingContext.Provider>
  );
}
