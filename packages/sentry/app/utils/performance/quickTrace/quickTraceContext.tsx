import {createContext} from 'react';

import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';

export type QuickTraceContextChildrenProps = QuickTraceQueryChildrenProps | undefined;

export const QuickTraceContext = createContext<QuickTraceContextChildrenProps>(undefined);
