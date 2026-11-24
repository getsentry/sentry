import {parseAsString, useQueryState} from 'nuqs';

import {
  PaginationBehaviorContextProvider,
  type CursorHandler,
} from '@sentry/scraps/pagination';

export function SentryPaginationProvider({children}: {children: React.ReactNode}) {
  const [, setCursor] = useQueryState(
    'cursor',
    parseAsString.withOptions({history: 'push'})
  );
  const onCursor: CursorHandler = cursor => {
    void setCursor(cursor ?? null);
  };

  return (
    <PaginationBehaviorContextProvider value={onCursor}>
      {children}
    </PaginationBehaviorContextProvider>
  );
}
