import {createContext, useContext} from 'react';

import type {CodecovPeriodOptions} from 'sentry/components/codecov/datePicker/dateSelector';

export type CodecovContextData = {
  changeContextValue: (value: Partial<CodecovContextDataParams>) => void;
  codecovPeriod: CodecovPeriodOptions;
  branch?: string;
  integratedOrg?: string;
  repository?: string;
};

export type CodecovContextDataParams = Omit<CodecovContextData, 'changeContextValue'>;

export const CodecovContext = createContext<CodecovContextData | undefined>(undefined);

export function useCodecovContext() {
  const context = useContext(CodecovContext);
  if (context === undefined)
    throw new Error('useCodecovContext was called outside of CodecovProvider');
  return context;
}
