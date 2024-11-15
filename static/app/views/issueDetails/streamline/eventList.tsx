import {useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {
  GridBodyCell,
  GridHead,
  GridHeadCell,
  GridResizer,
  GridRow,
} from 'sentry/components/gridEditable/styles';
import Panel from 'sentry/components/panels/panel';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type Group, IssueType} from 'sentry/types/group';
import {parseCursor} from 'sentry/utils/cursor';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useEventColumns} from 'sentry/views/issueDetails/allEventsTable';
import {ALL_EVENTS_EXCLUDED_TAGS} from 'sentry/views/issueDetails/groupEvents';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

interface EventListProps {
  group: Group;
}

export function EventList({group}: EventListProps) {
  const referrer = 'issue_details.streamline_list';
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const routes = useRoutes();
  const [_error, setError] = useState('');
  const {fields, columnTitles} = useEventColumns(group, organization);
  const eventView = useIssueDetailsEventView({
    group,
    queryProps: {
      fields,
      widths: fields.map(field => {
        switch (field) {
          case 'id':
          case 'trace':
          case 'replayId':
            // Id columns can be smaller
            return '100';
          case 'environment':
            // Big enough to fit "Environment"
            return '115';
          case 'timestamp':
            return '220';
          case 'url':
            return '300';
          case 'title':
          case 'transaction':
            return '200';
          default:
            return '150';
        }
      }),
    },
  });

  eventView.sorts = decodeSorts(location.query.sort).filter(sort =>
    fields.includes(sort.field)
  );

  if (!eventView.sorts.length) {
    eventView.sorts = [{field: 'timestamp', kind: 'desc'}];
  }

  const grayText = css`
    color: ${theme.subText};
    font-weight: ${theme.fontWeightNormal};
  `;

  const isRegressionIssue =
    group.issueType === IssueType.PERFORMANCE_DURATION_REGRESSION ||
    group.issueType === IssueType.PERFORMANCE_ENDPOINT_REGRESSION;

  return (
    <StreamlineEventsTable>
      <EventsTable
        eventView={eventView}
        location={location}
        issueId={group.id}
        isRegressionIssue={isRegressionIssue}
        organization={organization}
        routes={routes}
        excludedTags={ALL_EVENTS_EXCLUDED_TAGS}
        projectSlug={group.project.slug}
        customColumns={['minidump']}
        setError={err => setError(err ?? '')}
        transactionName={group.title || group.type}
        columnTitles={columnTitles}
        referrer={referrer}
        hidePagination
        renderTableHeader={({
          pageLinks,
          pageEventsCount,
          totalEventsCount,
          isPending,
        }) => {
          const links = parseLinkHeader(pageLinks);
          const previousDisabled = links.previous?.results === false;
          const nextDisabled = links.next?.results === false;
          const currentCursor = parseCursor(location.query?.cursor);
          const start = Math.max(currentCursor?.offset ?? 1, 1);

          return (
            <EventListHeader>
              <EventListTitle>{t('All Events')}</EventListTitle>
              <EventListHeaderItem>
                {isPending || pageEventsCount === 0
                  ? null
                  : tct('Showing [start]-[end] of [count] matching events', {
                      start: start.toLocaleString(),
                      end: (
                        (currentCursor?.offset ?? 0) + pageEventsCount
                      ).toLocaleString(),
                      count: (totalEventsCount ?? 0).toLocaleString(),
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
                    to={{
                      ...location,
                      query: {
                        ...location.query,
                        cursor: links.previous?.cursor,
                      },
                    }}
                    disabled={isPending || previousDisabled}
                  />
                  <LinkButton
                    aria-label={t('Next Page')}
                    borderless
                    size="xs"
                    icon={<IconChevron direction="right" />}
                    css={grayText}
                    to={{
                      ...location,
                      query: {
                        ...location.query,
                        cursor: links.next?.cursor,
                      },
                    }}
                    disabled={isPending || nextDisabled}
                  />
                </ButtonBar>
              </EventListHeaderItem>
            </EventListHeader>
          );
        }}
      />
    </StreamlineEventsTable>
  );
}

const EventListHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: ${space(1.5)};
  align-items: center;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(1.5)};
  background: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
  border-radius: ${p => p.theme.borderRadiusTop};
`;

const EventListTitle = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const EventListHeaderItem = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StreamlineEventsTable = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};

  ${Panel} {
    border: 0;
    margin-bottom: 0;
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
    text-transform: none;
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
    &:first-child {
      padding-left: ${space(1.5)};
    }
  }

  ${GridBodyCell} {
    min-height: unset;
    padding: ${space(1)} ${space(1.5)};
    font-size: ${p => p.theme.fontSizeMedium};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  ${GridRow} {
    td:nth-child(2) {
      padding-left: ${space(1.5)};
    }

    td:not(:nth-child(2)) {
      a {
        color: ${p => p.theme.textColor};
        text-decoration: underline;
        text-decoration-color: ${p => p.theme.border};
      }
    }
  }
`;
