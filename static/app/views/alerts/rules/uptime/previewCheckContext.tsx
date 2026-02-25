import {createContext, useContext, useState} from 'react';

import type {
  PreviewCheckCompilationError,
  PreviewCheckResult,
} from 'sentry/views/alerts/rules/uptime/types';

export {extractCompilationError} from 'sentry/views/alerts/rules/uptime/assertionFormErrors';

type PreviewCheckResultState = {
  data: PreviewCheckResult | null;
  error: PreviewCheckCompilationError | null;
};

type PreviewCheckResultContextType = PreviewCheckResultState & {
  setPreviewCheckData: (data: PreviewCheckResult | null) => void;
  setPreviewCheckError: (error: PreviewCheckCompilationError | null) => void;
  resetPreviewCheckResult: () => void;
};

const PreviewCheckResultContext =
  createContext<PreviewCheckResultContextType | null>(null);

export function PreviewCheckResultProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<PreviewCheckResultState>({
    data: null,
    error: null,
  });

  const setPreviewCheckData = (data: PreviewCheckResult | null) =>
    setState({data, error: null});

  const setPreviewCheckError = (error: PreviewCheckCompilationError | null) =>
    setState({data: null, error});

  const resetPreviewCheckResult = () => setState({data: null, error: null});

  return (
    <PreviewCheckResultContext.Provider
      value={{...state, setPreviewCheckData, setPreviewCheckError, resetPreviewCheckResult}}
    >
      {children}
    </PreviewCheckResultContext.Provider>
  );
}

export function usePreviewCheckResult() {
  const context = useContext(PreviewCheckResultContext);
  if (!context) {
    throw new Error(
      'usePreviewCheckResult must be used within a PreviewCheckResultProvider'
    );
  }
  return context;
}
