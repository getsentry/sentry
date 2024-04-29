import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  Breadcrumbs,
  SearchAndSortWrapper,
} from 'sentry/components/events/interfaces/breadcrumbs';
import {
  BreadcrumbRow,
  StyledBreadcrumbPanelTable,
} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumbs';
import {PanelTableHeader} from 'sentry/components/panels/panelTable';
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
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(false);

  const matchingEntry: EntryBreadcrumbs | undefined = event?.entries?.find(
    (entry): entry is EntryBreadcrumbs => entry.type === EntryType.BREADCRUMBS
  );

  if (!matchingEntry) {
    return null;
  }

  const renderText = showBreadcrumbs ? t('Hide Breadcrumbs') : t('Show Breadcrumbs');
  const chevron = <IconChevron size="xs" direction={showBreadcrumbs ? 'up' : 'down'} />;
  return (
    <Fragment>
      <a
        style={{display: 'flex', alignItems: 'center', gap: space(0.5)}}
        onClick={() => {
          setShowBreadcrumbs(prev => !prev);
        }}
      >
        {renderText} {chevron}
      </a>
      {showBreadcrumbs && (
        <ResponsiveBreadcrumbWrapper>
          <Breadcrumbs
            hideTitle
            data={matchingEntry.data}
            event={event}
            organization={organization}
          />
        </ResponsiveBreadcrumbWrapper>
      )}
    </Fragment>
  );
}

const ResponsiveBreadcrumbWrapper = styled('div')`
  container: breadcrumbs / inline-size;

  ${SearchAndSortWrapper} {
    > div {
      width: auto !important;
    }
  }

  ${StyledBreadcrumbPanelTable} {
    @container breadcrumbs (width < 640px) {
      grid-template-columns: 64px 1fr 106px;
    }
  }

  @container breadcrumbs (width < 640px) {
    ${PanelTableHeader}:nth-child(2) {
      display: none;
    }

    ${PanelTableHeader}:nth-child(4) {
      display: none;
    }
  }

  ${BreadcrumbRow} {
    @container breadcrumbs (width < 640px) {
      > div {
        grid-template-columns: 64px 1fr 106px;
      }

      ${PanelTableHeader}:nth-child(2),
      > div > div:nth-child(2) {
        display: none;
      }

      ${PanelTableHeader}:nth-child(4),
      > div > span:nth-child(4) {
        display: none;
      }
    }
  }
`;
