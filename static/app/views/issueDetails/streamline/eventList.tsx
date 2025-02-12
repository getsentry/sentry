import {useState} from 'react';

import ButtonBar from 'sentry/components/buttonBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {type Group, IssueType} from 'sentry/types/group';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useEventColumns} from 'sentry/views/issueDetails/allEventsTable';
import {ALL_EVENTS_EXCLUDED_TAGS} from 'sentry/views/issueDetails/groupEvents';
import {
  EventListTable,
  Header,
  HeaderItem,
  PaginationButton,
  PaginationText,
  Title,
} from 'sentry/views/issueDetails/streamline/eventListTable';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

interface EventListProps {
  group: Group;
}

export function EventList({group}: EventListProps) {
  const referrer = 'issue_details.streamline_list';
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

  const isRegressionIssue =
    group.issueType === IssueType.PERFORMANCE_DURATION_REGRESSION ||
    group.issueType === IssueType.PERFORMANCE_ENDPOINT_REGRESSION;

  return (
    <EventListTable pagination={{enabled: false}}>
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
        applyEnvironmentFilter
        renderTableHeader={({
          pageLinks,
          pageEventsCount,
          totalEventsCount,
          isPending,
        }) => {
          const links = parseLinkHeader(pageLinks);
          const previousDisabled = links.previous?.results === false;
          const nextDisabled = links.next?.results === false;

          return (
            <Header>
              <Title>{t('All Events')}</Title>
              <HeaderItem>
                <PaginationText
                  pageCount={pageEventsCount}
                  totalCount={totalEventsCount}
                  tableUnits={t('events')}
                />
              </HeaderItem>
              <HeaderItem>
                <ButtonBar gap={0.25}>
                  <PaginationButton
                    aria-label={t('Previous Page')}
                    borderless
                    size="xs"
                    icon={<IconChevron direction="left" />}
                    to={{
                      ...location,
                      query: {
                        ...location.query,
                        cursor: links.previous?.cursor,
                      },
                    }}
                    disabled={isPending || previousDisabled}
                  />
                  <PaginationButton
                    aria-label={t('Next Page')}
                    borderless
                    size="xs"
                    icon={<IconChevron direction="right" />}
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
              </HeaderItem>
            </Header>
          );
        }}
      />
    </EventListTable>
  );
}
