import {useMemo} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
  EventNavigator,
} from 'sentry/components/events/eventDrawer';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
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

import {useEventLogsUrl} from './useEventLogsUrl';

interface LogIssueDrawerProps {
  event: Event;
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
  embeddedOptions,
  additionalData: propAdditionalData,
}: LogIssueDrawerProps) {
  const organization = useOrganization();
  const supportsArrays = organization.features.includes('trace-item-array-query-support');
  const setLogsQuery = useSetQueryParamsQuery();
  const logsSearch = useQueryParamsSearch();

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useLogItemAttributes({}, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useLogItemAttributes({}, 'number');
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useLogItemAttributes({}, 'boolean');
  const {attributes: arrayAttributes, secondaryAliases: arraySecondaryAliases} =
    useLogItemAttributes({enabled: supportsArrays}, 'array');

  const tracesItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch: (query: string) => setLogsQuery(query),
    arrayAttributes,
    booleanAttributes,
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS,
    arraySecondaryAliases,
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

  const exploreUrl = useEventLogsUrl(event);

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
      <EventDrawerContainer>
        <DrawerHeader>
          <DrawerBreadcrumbs
            current={{
              label: t('Logs'),
              labelTooltip: t('Event ID: %s', getShortEventId(event.id)),
            }}
          />
        </DrawerHeader>
        <EventNavigator
          leadingItems={
            <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
          }
          trailingItems={
            exploreUrl ? (
              <LinkButton size="sm" to={exploreUrl} openInNewTab>
                {t('Open in Explore')}
              </LinkButton>
            ) : null
          }
        />
        <EventDrawerBody>
          <Stack position="relative" flex="1" minHeight="0">
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
