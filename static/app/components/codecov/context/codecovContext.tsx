import {createContext, useContext} from 'react';

export type CodecovContextData = {
  changeContextValue: (value: Partial<CodecovContextDataParams>) => void;
  codecovPeriod: string;
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
