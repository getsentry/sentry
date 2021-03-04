import React from 'react';

import {QuickTraceQueryChildrenProps} from 'app/utils/performance/quickTrace/types';

export type QuickTraceContextChildrenProps = QuickTraceQueryChildrenProps | undefined;

const QuickTraceContext = React.createContext<QuickTraceContextChildrenProps>(undefined);

export const Provider = QuickTraceContext.Provider;

export const Consumer = QuickTraceContext.Consumer;
