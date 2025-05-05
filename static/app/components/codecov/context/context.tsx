import {createContext, useContext} from 'react';

import type {
  CodecovContextSetterTypes,
  CodecovContextTypes,
} from 'sentry/components/codecov/container/container';

export const CodecovContext = createContext<
  (CodecovContextTypes & CodecovContextSetterTypes) | undefined
>(undefined);

export function useCodecovContext() {
  const context = useContext(CodecovContext);
  if (!context) throw new Error('useCodecovContext must be used within CodecovProvider');
  return context;
}
