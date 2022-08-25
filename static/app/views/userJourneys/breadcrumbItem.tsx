import {useEffect, useRef} from 'react';

import {Breadcrumb} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb';
import {PanelTable} from 'sentry/components/panels';
import {EntryType} from 'sentry/types';
import {Crumb} from 'sentry/types/breadcrumbs';

import useIsInViewport from './useIsInViewport';

type Props = Pick<
  React.ComponentProps<typeof Breadcrumb>,
  | 'event'
  | 'organization'
  | 'searchTerm'
  | 'relativeTime'
  | 'displayRelativeTime'
  | 'router'
  | 'route'
> & {
  activeCrumb: Crumb | undefined;
  breadcrumb: Crumb;
  breadcrumbs: Crumb[];
  emptyMessage: Pick<
    React.ComponentProps<typeof PanelTable>,
    'emptyMessage' | 'emptyAction'
  >;
  index: number;
  isLastItem: boolean;
  onSwitchTimeFormat: () => void;
};

function BreadcrumbItem(props: Props) {
  const scrollbarSize = 20;
  const {
    breadcrumb,
    activeCrumb,
    isLastItem,
    organization,
    event,
    router,
    searchTerm,
    relativeTime,
    displayRelativeTime,
    route,
    index,
  } = props;

  const entryIndex = event.entries.findIndex(
    entry => entry.type === EntryType.BREADCRUMBS
  );

  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const isInViewport = useIsInViewport(breadcrumbRef);

  if (isInViewport) {
    // console.log(`${index} is in view`);
  }

  const isActive = activeCrumb && activeCrumb.id === breadcrumb.id;

  useEffect(() => {
    if (isActive && breadcrumbRef.current) {
      const element = breadcrumbRef.current;
      element?.scrollIntoView?.({block: 'end', behavior: 'smooth'});
    }
  }, [isActive]);

  return (
    <div key={breadcrumb.id} ref={breadcrumbRef}>
      <Breadcrumb
        data-test-id={isLastItem ? 'last-crumb' : 'crumb'}
        style={{}}
        onLoad={() => {}}
        organization={organization}
        searchTerm={searchTerm}
        breadcrumb={breadcrumb}
        meta={event._meta?.entries?.[entryIndex]?.data?.values?.[index]}
        event={event}
        relativeTime={relativeTime}
        displayRelativeTime={displayRelativeTime}
        height={undefined}
        scrollbarSize={scrollbarSize}
        router={router}
        route={route}
      />
    </div>
  );
}

export default BreadcrumbItem;
