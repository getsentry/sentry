import React from 'react';

import {TraceLiteQueryChildrenProps} from 'app/utils/performance/quickTrace/types';

export type QuickTraceContextChildrenProps = TraceLiteQueryChildrenProps | undefined;

const QuickTraceContext = React.createContext<QuickTraceContextChildrenProps>(undefined);

export const Provider = QuickTraceContext.Provider;

export const Consumer = QuickTraceContext.Consumer;
