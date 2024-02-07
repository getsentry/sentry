import {createContext, useCallback} from 'react';

import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Data = {
  orgSlugs: string;
  regionUrl: string;
  file?: File;
  promoCode?: string;
};

export type RelocationOnboardingContextProps = {
  data: Data;
  setData: (data: Data) => void;
};

export const RelocationOnboardingContext =
  createContext<RelocationOnboardingContextProps>({
    data: {
      orgSlugs: '',
      regionUrl: '',
      file: undefined,
      promoCode: '',
    },
    setData: () => {},
  });

type ProviderProps = {
  children: React.ReactNode;
  value?: Data;
};

export function RelocationOnboardingContextProvider({children, value}: ProviderProps) {
  const [sessionStorage, setSessionStorage] = useSessionStorage<Data>(
    'relocationOnboarding',
    {
      orgSlugs: value?.orgSlugs || '',
      regionUrl: value?.regionUrl || '',
      promoCode: value?.promoCode || '',
      file: value?.file || undefined,
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
