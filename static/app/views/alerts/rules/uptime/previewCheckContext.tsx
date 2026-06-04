import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import type {
  PreviewCheckError,
  PreviewCheckResult,
} from 'sentry/views/alerts/rules/uptime/types';

type PreviewCheckResultState = {
  data: PreviewCheckResult | null;
  error: PreviewCheckError | null;
};

type PreviewCheckResultContextValue = PreviewCheckResultState & {
  resetPreviewCheckResult: () => void;
  setPreviewCheckData: (data: PreviewCheckResult | null) => void;
  setPreviewCheckError: (error: PreviewCheckError | null) => void;
};

const PreviewCheckResultContext = createContext<PreviewCheckResultContextValue | null>(
  null
);

export function PreviewCheckResultProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<PreviewCheckResultState>({
    data: null,
    error: null,
  });

  const setPreviewCheckData = useCallback(
    (data: PreviewCheckResult | null) => setState({data, error: null}),
    []
  );

  const setPreviewCheckError = useCallback(
    (error: PreviewCheckError | null) => setState({data: null, error}),
    []
  );

  const resetPreviewCheckResult = useCallback(
    () => setState({data: null, error: null}),
    []
  );

  const value = useMemo(
    () => ({
      ...state,
      setPreviewCheckData,
      setPreviewCheckError,
      resetPreviewCheckResult,
    }),
    [state, setPreviewCheckData, setPreviewCheckError, resetPreviewCheckResult]
  );

  return (
    <PreviewCheckResultContext.Provider value={value}>
      {children}
    </PreviewCheckResultContext.Provider>
  );
}

export function usePreviewCheckResult(): PreviewCheckResultContextValue | null {
  return useContext(PreviewCheckResultContext);
}
