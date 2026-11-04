import {parseAsString, useQueryState} from 'nuqs';

import {PaginationBehaviorContextProvider} from '@sentry/scraps/pagination';

/** Keep URL navigation out of the portable pagination component. */
export function SentryPaginationProvider({children}: {children: React.ReactNode}) {
  const [, setCursor] = useQueryState(
    'cursor',
    parseAsString.withOptions({history: 'push', shallow: false})
  );
  const onCursor = (cursor: string | undefined) => {
    void setCursor(cursor ?? null);
  };

  return (
    <PaginationBehaviorContextProvider value={onCursor}>
      {children}
    </PaginationBehaviorContextProvider>
  );
}
