import {createContext, useContext} from 'react';

export type CodecovContextData = {
  branch: string | null;
  codecovPeriod: string | null;
  integratedOrg: string | null;
  repository: string | null;
};

export const CodecovContext = createContext<CodecovContextData | undefined>(undefined);

export function useCodecovContext() {
  const context = useContext(CodecovContext);
  if (context === undefined)
    throw new Error('useCodecovContext was called outside of CodecovProvider');
  return context;
}
