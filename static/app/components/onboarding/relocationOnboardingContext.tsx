import {createContext, useCallback} from 'react';

import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type Data = {
  orgSlugs: string;
  region: string;
  file?: File;
};

export type RelocationOnboardingContextProps = {
  data: Data;
  setData: (data: Data) => void;
};

export const RelocationOnboardingContext =
  createContext<RelocationOnboardingContextProps>({
    data: {
      orgSlugs: '',
      region: '',
      file: undefined,
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
      region: value?.region || '',
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
