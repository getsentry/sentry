import {useRef} from 'react';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {
  useQueryParamsSearch,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';

interface MetricsIssueDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function MetricsDrawer({event, project, group}: MetricsIssueDrawerProps) {
  const setMetricsQuery = useSetQueryParamsQuery();
  const metricsSearch = useQueryParamsSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  return (
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
            {label: t('Metrics')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator style={{gap: '0px'}}>
        <SearchQueryBuilder
          placeholder={t('Search metrics for this trace')}
          filterKeys={{}}
          getTagValues={() => new Promise<string[]>(() => [])}
          initialQuery={metricsSearch.formatString()}
          searchSource="tracemetrics"
          onSearch={query => setMetricsQuery(query)}
        />
      </EventNavigator>
      <EventDrawerBody ref={containerRef}>
        <div>
          <MetricsSamplesTable embedded />
        </div>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
