import {useMemo} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {useEventLogsUrl} from 'sentry/components/events/ourlogs/useEventLogsUrl';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {getShortEventId} from 'sentry/utils/events';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {
  useQueryParamsSearch,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

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
  const setLogsQuery = useSetQueryParamsQuery();
  const logsSearch = useQueryParamsSearch();

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useLogItemAttributes({}, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useLogItemAttributes({}, 'number');
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useLogItemAttributes({}, 'boolean');

  const tracesItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch: (query: string) => setLogsQuery(query),
    booleanAttributes,
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS,
    booleanSecondaryAliases,
    numberSecondaryAliases,
    stringSecondaryAliases,
  };
  const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  const additionalData = useMemo(
    () => ({
      event,
      scrollToDisabled: propAdditionalData?.scrollToDisabled,
    }),
    [event, propAdditionalData?.scrollToDisabled]
  );

  const exploreUrl = useEventLogsUrl(event, project);

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
              <LinkButton size="sm" to={exploreUrl} openInNewTab>
                {t('Open in Explore')}
              </LinkButton>
            )}
          </Flex>
        </EventNavigator>
        <EventDrawerBody>
          <Stack position="relative">
            <LogsInfiniteTable
              embedded
              embeddedOptions={embeddedOptions}
              additionalData={additionalData}
              analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
            />
          </Stack>
        </EventDrawerBody>
      </EventDrawerContainer>
    </SearchQueryBuilderProvider>
  );
}
