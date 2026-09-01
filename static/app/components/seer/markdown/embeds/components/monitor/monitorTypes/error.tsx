import {lazy} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LazyLoad} from 'sentry/components/lazyLoad';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

/**
 * Error monitors have no configuration worth previewing, so the unresolved
 * issues they group are the whole body.
 */
export function ErrorMonitor({id, statsPeriod}: {id: string; statsPeriod?: string}) {
  return (
    <ErrorBoundary mini>
      <LazyLoad
        LazyComponent={LazyGroupList}
        queryParams={{
          query: `is:unresolved detector:${id}`,
          statsPeriod: statsPeriod ?? '24h',
          limit: 5,
        }}
        numPlaceholderRows={3}
        withChart={false}
        withColumns={[]}
        withHeader={false}
        withPagination={false}
        canSelectGroups={false}
        useFilteredStats={false}
      />
    </ErrorBoundary>
  );
}
