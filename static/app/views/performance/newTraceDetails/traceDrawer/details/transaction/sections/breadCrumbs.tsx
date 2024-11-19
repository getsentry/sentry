import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {
  Breadcrumbs,
  SearchAndSortWrapper,
} from 'sentry/components/events/interfaces/breadcrumbs';
import {
  BreadcrumbRow,
  StyledBreadcrumbPanelTable,
} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumbs';
import {LazyRender} from 'sentry/components/lazyRender';
import ExternalLink from 'sentry/components/links/externalLink';
import {PanelTableHeader} from 'sentry/components/panels/panelTable';
import {t, tct} from 'sentry/locale';
import {
  type EntryBreadcrumbs,
  EntryType,
  type EventTransaction,
} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';

import {TraceDrawerComponents} from '../../styles';

export function BreadCrumbs({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const hasNewTraceUi = useHasTraceNewUi();
  const matchingEntry: EntryBreadcrumbs | undefined = event?.entries?.find(
    (entry): entry is EntryBreadcrumbs => entry.type === EntryType.BREADCRUMBS
  );

  if (!matchingEntry) {
    return null;
  }

  if (!hasNewTraceUi) {
    return <LegacyBreadCrumbs event={event} organization={organization} />;
  }

  return (
    <ResponsiveBreadcrumbWrapper>
      <Breadcrumbs data={matchingEntry.data} event={event} organization={organization} />
    </ResponsiveBreadcrumbWrapper>
  );
}

function LegacyBreadCrumbs({
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
    <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
      <EventDataSection
        showPermalink={false}
        key={'breadcrumbs'}
        type={'breadcrumbs'}
        title={t('Breadcrumbs')}
        help={tct(
          'The trail of events that happened prior to an event. [link:Learn more]',
          {
            link: (
              <ExternalLink
                openInNewTab
                href={'https://docs.sentry.io/product/issues/issue-details/breadcrumbs/'}
              />
            ),
          }
        )}
        isHelpHoverable
      >
        <ResponsiveBreadcrumbWrapper>
          <Breadcrumbs
            hideTitle
            data={matchingEntry.data}
            event={event}
            organization={organization}
          />
        </ResponsiveBreadcrumbWrapper>
      </EventDataSection>
    </LazyRender>
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
