import {createContext, useContext, useState} from 'react';

import type {
  PreviewCheckCompilationError,
  PreviewCheckResponse,
} from 'sentry/views/alerts/rules/uptime/types';

export {extractCompilationError} from 'sentry/views/alerts/rules/uptime/assertionFormErrors';

type PreviewCheckResultsState = {
  data: PreviewCheckResponse | null;
  error: PreviewCheckCompilationError | null;
};

type PreviewCheckResultsContextType = PreviewCheckResultsState & {
  setData: (data: PreviewCheckResponse | null) => void;
  setError: (error: PreviewCheckCompilationError | null) => void;
  reset: () => void;
};

const PreviewCheckResultsContext =
  createContext<PreviewCheckResultsContextType | null>(null);

export function PreviewCheckResultsProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<PreviewCheckResultsState>({
    data: null,
    error: null,
  });

  const setData = (data: PreviewCheckResponse | null) =>
    setState({data, error: null});

  const setError = (error: PreviewCheckCompilationError | null) =>
    setState({data: null, error});

  const reset = () => setState({data: null, error: null});

  return (
    <PreviewCheckResultsContext.Provider value={{...state, setData, setError, reset}}>
      {children}
    </PreviewCheckResultsContext.Provider>
  );
}

export function usePreviewCheckResults() {
  const context = useContext(PreviewCheckResultsContext);
  if (!context) {
    throw new Error(
      'usePreviewCheckResults must be used within a PreviewCheckResultsProvider'
    );
  }
  return context;
}
