import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {
  GridBodyCell,
  GridHead,
  GridHeadCell,
  GridResizer,
} from 'sentry/components/gridEditable/styles';
import Panel from 'sentry/components/panels/panel';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import AllEventsTable from 'sentry/views/issueDetails/allEventsTable';
import {ALL_EVENTS_EXCLUDED_TAGS} from 'sentry/views/issueDetails/groupEvents';
import {
  useIssueDetailsDiscoverQuery,
  useIssueDetailsEventView,
} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';
import {EventTablePagination} from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

interface EventListProps {
  group: Group;
  project: Project;
}

export function EventList({group}: EventListProps) {
  const currentRange = [0, 25];
  const totalCount = 259;
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();
  const grayText = css`
    color: ${theme.subText};
    font-weight: ${theme.fontWeightNormal};
  `;

  const eventView = useIssueDetailsEventView({group});
  const {data, response} = useIssueDetailsDiscoverQuery<TableData>({
    params: {
      eventView,
      route: 'events',
      referrer: 'issue_details.streamline_list',
    },
  });
  const pageLinks = response?.getResponseHeader('Link') ?? null;
  const links = parseLinkHeader(pageLinks);
  const previousDisabled = links.previous?.results === false;
  const nextDisabled = links.next?.results === false;
  // TODO: Can't use AllEventsTable since we need to mutate the query along with the event picker and timeline.

  return (
    <Fragment>
      <EventListHeader>
        <EventListTitle>{t('All Events')}</EventListTitle>
        <EventListHeaderItem>
          {tct('Showing [start]-[end] of [count]', {
            start: currentRange[0],
            end: currentRange[1],
            count: totalCount,
          })}
        </EventListHeaderItem>
        <EventListHeaderItem>
          <ButtonBar gap={0.25}>
            <LinkButton
              aria-label={t('Previous Page')}
              borderless
              size="xs"
              icon={<IconChevron direction="left" />}
              css={grayText}
              to={links.previous}
              disabled={previousDisabled}
            />
            <LinkButton
              aria-label={t('Next Page')}
              borderless
              size="xs"
              icon={<IconChevron direction="right" />}
              css={grayText}
              to={links.next}
              disabled={nextDisabled}
            />
          </ButtonBar>
        </EventListHeaderItem>
        <EventListHeaderItem>
          <Button borderless size="xs" css={grayText}>
            {t('Close')}
          </Button>
        </EventListHeaderItem>
      </EventListHeader>
      <StreamlineEventsTable>
        <AllEventsTable
          issueId={group.id}
          location={location}
          organization={organization}
          group={group}
          excludedTags={ALL_EVENTS_EXCLUDED_TAGS}
        />
      </StreamlineEventsTable>
    </Fragment>
  );
}

const EventListHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: ${space(1.5)};
  align-items: center;
  padding: ${space(0.75)} ${space(2)};
  background: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  position: sticky;
  top: 0;
  z-index: 500;
  border-radius: ${p => p.theme.borderRadiusTop};
`;

const EventListTitle = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const EventListHeaderItem = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StreamlineEventsTable = styled('div')`
  ${Panel} {
    border: 0;
  }
  ${GridHead} {
    min-height: unset;
    font-size: ${p => p.theme.fontSizeMedium};
    ${GridResizer} {
      height: 36px;
    }
  }
  ${GridHeadCell} {
    height: 36px;
    padding: 0 ${space(1.5)};
    white-space: nowrap;
    text-overflow: ellipsis;
    text-transform: capitalize;
    border-width: 0 1px 0 0;
    border-style: solid;
    border-image: linear-gradient(
        to bottom,
        transparent,
        transparent 30%,
        ${p => p.theme.border} 30%,
        ${p => p.theme.border} 70%,
        transparent 70%,
        transparent
      )
      1;
    &:last-child {
      border: 0;
    }
  }
  ${GridBodyCell} {
    min-height: unset;
    padding: ${space(1)} ${space(1.5)};
    font-size: ${p => p.theme.fontSizeMedium};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    a {
      color: ${p => p.theme.textColor};
    }
  }
  ${EventTablePagination} {
    border: 2px solid red;
  }
  a {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-color: ${p => p.theme.border};
  }
`;
