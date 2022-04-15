import {useState} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Breadcrumb from 'sentry/components/events/interfaces/breadcrumbs/breadcrumbs';
import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {t} from 'sentry/locale';
import {Entry} from 'sentry/types/event';

interface Props
  extends Pick<
    React.ComponentProps<typeof Breadcrumb>,
    'event' | 'organization' | 'router' | 'route'
  > {
  entry: Entry;
}

function Breadcrumbs({entry, event, organization, route, router}: Props) {
  const [displayRelativeTime, setDisplayRelativeTime] = useState(false);

  const transformedCrumbs = transformCrumbs(entry.data.values);
  const relativeTime = transformedCrumbs[transformedCrumbs.length - 1]?.timestamp;

  return (
    <ErrorBoundary>
      <Breadcrumb
        narrow
        router={router}
        route={route}
        emptyMessage={{emptyMessage: t('There are no breadcrumbs to be displayed')}}
        breadcrumbs={transformedCrumbs}
        event={event}
        organization={organization}
        onSwitchTimeFormat={() => setDisplayRelativeTime(!displayRelativeTime)}
        displayRelativeTime={displayRelativeTime}
        searchTerm=""
        relativeTime={relativeTime!} // relativeTime has to be always available, as the last item timestamp is the event created time
      />
    </ErrorBoundary>
  );
}

export default Breadcrumbs;
