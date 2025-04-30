import type React from 'react';
import {createContext, useContext} from 'react';
import type {Location} from 'history';

import type {
  CodecovContextSetterTypes,
  CodecovContextTypes,
} from 'sentry/components/codecov/container/container';
import {
  getCodecovDataFromLocalStorage,
  setCodecovDataToLocalStorage,
} from 'sentry/components/codecov/container/persistence';
import {getCodecovParamsFromQuery} from 'sentry/components/codecov/container/url';

// Constants
export const DEFAULT_CODECOV_CONTEXT_VALUES = {
  repository: null,
};

// Types
export type InitializeCodecovContextParams = {
  orgSlug: string;
  queryParams: Location['query'];
  setState: React.Dispatch<React.SetStateAction<CodecovContextTypes>>;
};

type SetRepositoryContextParams = {
  orgSlug: string;
  repository: string;
  setState: React.Dispatch<React.SetStateAction<CodecovContextTypes>>;
};

// Context definition
export const CodecovContext = createContext<
  (CodecovContextTypes & CodecovContextSetterTypes) | undefined
>(undefined);

export function useCodecovContext() {
  const context = useContext(CodecovContext);
  if (!context) throw new Error('useCodecovContext must be used within CodecovProvider');
  return context;
}

// Context functions

/**
 * This function initializes the Codecov context data from relevant url params and local storage data. It will:
 * 1) Initialize context from URL data if existent - it won't populate data from local storage if this is the case.
 * 2) Initialize context from local storage if data is existent.
 * 3) Initialize context from default data.
 */
export function initializeCodecovContext({
  queryParams,
  orgSlug,
  setState,
}: InitializeCodecovContextParams) {
  // 1)
  const dataFromQuery = getCodecovParamsFromQuery(queryParams);
  const hasAnyNonNull = Object.values(dataFromQuery).some(value => value !== null);

  if (hasAnyNonNull) {
    setState(prev => ({...prev, ...dataFromQuery}));
    return;
  }

  // 2)
  const dataFromLocalStorage = getCodecovDataFromLocalStorage(orgSlug);
  if (dataFromLocalStorage) {
    setState(prev => ({...prev, ...dataFromLocalStorage}));
    return;
  }

  // 3)
  setState(prev => ({...prev, ...DEFAULT_CODECOV_CONTEXT_VALUES}));
  return;
}

// Stores state to local storage, url and Codecov context
export const setRepositoryToContext = ({
  orgSlug,
  repository,
  setState,
}: SetRepositoryContextParams) => {
  return setState(prev => {
    const newState = {...prev, repository};
    setCodecovDataToLocalStorage(orgSlug, newState);
    // TODO: add method to store params in URL

    return newState;
  });
};
