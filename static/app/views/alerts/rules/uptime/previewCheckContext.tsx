import {createContext, useContext, useState} from 'react';

import type {
  PreviewCheckError,
  PreviewCheckResult,
} from 'sentry/views/alerts/rules/uptime/types';

export {extractPreviewCheckError as extractCompilationError} from 'sentry/views/alerts/rules/uptime/formErrors';

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

  const setPreviewCheckData = (data: PreviewCheckResult | null) =>
    setState({data, error: null});

  const setPreviewCheckError = (error: PreviewCheckError | null) =>
    setState({data: null, error});

  const resetPreviewCheckResult = () => setState({data: null, error: null});

  return (
    <PreviewCheckResultContext.Provider
      value={{
        ...state,
        setPreviewCheckData,
        setPreviewCheckError,
        resetPreviewCheckResult,
      }}
    >
      {children}
    </PreviewCheckResultContext.Provider>
  );
}

export function usePreviewCheckResult(): PreviewCheckResultContextValue | null {
  return useContext(PreviewCheckResultContext);
}
