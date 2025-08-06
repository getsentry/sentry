import type {ReactNode} from 'react';
import {useMemo} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

export interface QueryExtrasContextValue {
  projectIds?: number[];
  spanId?: string;
  traceId?: string;
}

const [_QueryExtrasContextProvider, _useQueryExtrasContext, QueryExtrasContext] =
  createDefinedContext<QueryExtrasContextValue>({
    name: 'QueryExtrasContext',
  });

interface QueryExtrasContextProps extends QueryExtrasContextValue {
  children: ReactNode;
}

export function QueryExtrasContextProvider({
  children,
  projectIds,
  spanId,
  traceId,
}: QueryExtrasContextProps) {
  const value = useMemo(() => {
    return {projectIds, spanId, traceId};
  }, [projectIds, spanId, traceId]);
  return <QueryExtrasContext value={value}>{children}</QueryExtrasContext>;
}
