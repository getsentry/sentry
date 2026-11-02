import {useRef} from 'react';

import {DrawerHeader} from '@sentry/scraps/drawer';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
  EventNavigator,
} from 'sentry/components/events/eventDrawer';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {getShortEventId} from 'sentry/utils/events';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {
  useQueryParamsSearch,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';

interface MetricsIssueDrawerProps {
  event: Event;
}

export function MetricsDrawer({event}: MetricsIssueDrawerProps) {
  const setMetricsQuery = useSetQueryParamsQuery();
  const metricsSearch = useQueryParamsSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <EventDrawerContainer>
      <DrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Application Metrics'),
            labelTooltip: t('Event ID: %s', getShortEventId(event.id)),
          }}
        />
      </DrawerHeader>
      <EventNavigator
        search={
          <SearchQueryBuilder
            placeholder={t('Search application metrics for this trace')}
            filterKeys={{}}
            getTagValues={() => new Promise<string[]>(() => [])}
            initialQuery={metricsSearch.formatString()}
            searchSource="tracemetrics"
            onSearch={query => setMetricsQuery(query)}
          />
        }
      />
      <EventDrawerBody ref={containerRef}>
        <div>
          <MetricsSamplesTable source="issueDetails" />
        </div>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
