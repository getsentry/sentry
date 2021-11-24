import {createContext} from 'react';

import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';

export type QuickTraceContextChildrenProps = QuickTraceQueryChildrenProps | undefined;

const QuickTraceContext = createContext<QuickTraceContextChildrenProps>(undefined);

export const Provider = QuickTraceContext.Provider;

export const Consumer = QuickTraceContext.Consumer;
