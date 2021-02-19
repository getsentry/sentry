import React from 'react';

import {QuickTraceQueryChildrenProps} from './quickTraceQuery';

export type QuickTraceContextChildrenProps = QuickTraceQueryChildrenProps & {
  /**
   * A flag to indicate if the value was from the defaults.
   * Set this to false when providing the actual results to the Provider.
   */
  isDefault: boolean;
};

const QuickTraceContext = React.createContext<QuickTraceContextChildrenProps>({
  isDefault: true,
  isLoading: true,
  error: null,
  trace: null,
});

export const Provider = QuickTraceContext.Provider;

export const Consumer = QuickTraceContext.Consumer;
