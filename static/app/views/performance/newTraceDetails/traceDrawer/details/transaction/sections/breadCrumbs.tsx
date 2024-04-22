import {Fragment, useEffect, useRef, useState} from 'react';

import {Breadcrumbs} from 'sentry/components/events/interfaces/breadcrumbs';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type EntryBreadcrumbs,
  EntryType,
  type EventTransaction,
  type Organization,
} from 'sentry/types';

export function BreadCrumbs({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const [showBreadCrumbs, setShowBreadCrumbs] = useState(false);
  const breadCrumbsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (showBreadCrumbs) {
        breadCrumbsContainerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }, 100);
  }, [showBreadCrumbs, breadCrumbsContainerRef]);

  const matchingEntry: EntryBreadcrumbs | undefined = event?.entries?.find(
    (entry): entry is EntryBreadcrumbs => entry.type === EntryType.BREADCRUMBS
  );

  if (!matchingEntry) {
    return null;
  }

  const renderText = showBreadCrumbs ? t('Hide Breadcrumbs') : t('Show Breadcrumbs');
  const chevron = <IconChevron size="xs" direction={showBreadCrumbs ? 'up' : 'down'} />;
  return (
    <Fragment>
      <a
        style={{display: 'flex', alignItems: 'center', gap: space(0.5)}}
        onClick={() => {
          setShowBreadCrumbs(prev => !prev);
        }}
      >
        {renderText} {chevron}
      </a>
      <div ref={breadCrumbsContainerRef}>
        {showBreadCrumbs && (
          <Breadcrumbs
            hideTitle
            data={matchingEntry.data}
            event={event}
            organization={organization}
          />
        )}
      </div>
    </Fragment>
  );
}
