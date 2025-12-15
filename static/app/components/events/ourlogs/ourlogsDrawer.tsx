import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getUtcDateString} from 'sentry/utils/dates';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsSearch,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getEventEnvironment} from 'sentry/views/issueDetails/utils';

interface LogIssueDrawerProps {
  event: Event;
  group: Group;
  project: Project;
  additionalData?: {
    event?: Event;
    scrollToDisabled?: boolean;
  };
  embeddedOptions?: {
    openWithExpandedIds?: string[];
  };
}

export function OurlogsDrawer({
  event,
  project,
  group,
  embeddedOptions,
  additionalData: propAdditionalData,
}: LogIssueDrawerProps) {
  const organization = useOrganization();
  const setLogsQuery = useSetQueryParamsQuery();
  const logsSearch = useQueryParamsSearch();

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributes('string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributes('number');

  const tracesItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch: (query: string) => setLogsQuery(query),
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS,
    numberSecondaryAliases,
    stringSecondaryAliases,
  };
  const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const additionalData = useMemo(
    () => ({
      event,
      scrollToDisabled: propAdditionalData?.scrollToDisabled,
    }),
    [event, propAdditionalData?.scrollToDisabled]
  );

  const exploreUrl = useMemo(() => {
    const traceId = event.contexts.trace?.trace_id;
    if (!traceId) {
      return null;
    }

    const eventTimestamp = event.dateCreated || event.dateReceived;
    if (!eventTimestamp) {
      return null;
    }

    const eventMoment = moment(eventTimestamp);
    const start = getUtcDateString(eventMoment.clone().subtract(1, 'day'));
    const end = getUtcDateString(eventMoment.clone().add(1, 'day'));
    const environment = getEventEnvironment(event);

    return getLogsUrl({
      organization,
      selection: {
        projects: [parseInt(project.id, 10)],
        environments: environment ? [environment] : [],
        datetime: {
          start,
          end,
          period: null,
          utc: null,
        },
      },
      query: `${OurLogKnownFieldKey.TRACE_ID}:${traceId}`,
    });
  }, [event, organization, project.id]);

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
      <EventDrawerContainer>
        <EventDrawerHeader>
          <NavigationCrumbs
            crumbs={[
              {
                label: (
                  <CrumbContainer>
                    <ProjectAvatar project={project} />
                    <ShortId>{group.shortId}</ShortId>
                  </CrumbContainer>
                ),
              },
              {label: getShortEventId(event.id)},
              {label: t('Logs')},
            ]}
          />
        </EventDrawerHeader>
        <EventNavigator>
          <Flex align="center" gap="sm">
            <Flex flex="1">
              <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
            </Flex>
            {exploreUrl && (
              <LinkButton size="sm" href={exploreUrl} target="_blank">
                {t('Open in explore')}
              </LinkButton>
            )}
          </Flex>
        </EventNavigator>
        <EventDrawerBody ref={containerRef}>
          <LogsTableContainer>
            <LogsInfiniteTable
              embedded
              scrollContainer={containerRef}
              embeddedOptions={embeddedOptions}
              additionalData={additionalData}
            />
          </LogsTableContainer>
        </EventDrawerBody>
      </EventDrawerContainer>
    </SearchQueryBuilderProvider>
  );
}

const LogsTableContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
