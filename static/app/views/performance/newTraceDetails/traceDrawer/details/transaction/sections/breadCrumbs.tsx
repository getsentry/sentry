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
import {
  type EntryBreadcrumbs,
  EntryType,
  type EventTransaction,
} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';

export function BreadCrumbs({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const matchingEntry: EntryBreadcrumbs | undefined = event?.entries?.find(
    (entry): entry is EntryBreadcrumbs => entry.type === EntryType.BREADCRUMBS
  );

  if (!matchingEntry) {
    return null;
  }

  return (
    <ResponsiveBreadcrumbWrapper>
      <Breadcrumbs
        data={matchingEntry.data}
        event={event}
        organization={organization}
        disableCollapsePersistence
      />
    </ResponsiveBreadcrumbWrapper>
  );
}

const ResponsiveBreadcrumbWrapper = styled('div')`
  container: breadcrumbs / inline-size;

  ${SearchAndSortWrapper} {
    @container breadcrumbs (width < 600px) {
      display: none;
    }

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
