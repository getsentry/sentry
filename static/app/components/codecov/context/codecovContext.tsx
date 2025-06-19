import {createContext, useContext} from 'react';

import type {CodecovPeriodOptions} from 'sentry/components/codecov/datePicker/dateSelector';

export type CodecovContextData = {
  branch: string | null;
  codecovPeriod: CodecovPeriodOptions;
  handleReset: (valuesToReset: CodecovContextDataParams[]) => void;
  integratedOrg: string | null;
  repository: string | null;
};

export type CodecovContextDataParams = Exclude<keyof CodecovContextData, 'handleReset'>;

export const CodecovContext = createContext<CodecovContextData | undefined>(undefined);

export function useCodecovContext() {
  const context = useContext(CodecovContext);
  if (context === undefined)
    throw new Error('useCodecovContext was called outside of CodecovProvider');
  return context;
}
