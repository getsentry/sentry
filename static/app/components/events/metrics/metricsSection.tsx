import {useCallback, useRef} from 'react';

import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {MetricsDrawer} from 'sentry/components/events/metrics/metricsDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceViewMetricsDataProvider} from 'sentry/views/performance/newTraceDetails/traceMetrics';

export function MetricsSection({
  event,
  project,
  group,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
    return null;
  }

  return (
    <TraceViewMetricsDataProvider traceSlug={traceId}>
      <MetricsSectionContent event={event} group={group} project={project} />
    </TraceViewMetricsDataProvider>
  );
}

function MetricsSectionContent({
  event,
  project,
  group,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const organization = useOrganization();
  const feature = canUseMetricsUI(organization);
  const {openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const traceId = event.contexts?.trace?.trace_id;

  const {
    result: {data: tableData},
  } = useMetricSamplesTable({
    disabled: !traceId,
    limit: 5,
    traceMetric: undefined,
    fields: [],
    ingestionDelaySeconds: 120,
  });

  const onOpenMetricsDrawer = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      trackAnalytics('metrics.issue_details.drawer_opened', {
        organization,
      });
      openDrawer(
        () => (
          <TraceViewMetricsDataProvider traceSlug={traceId!}>
            <TraceItemAttributeProvider
              traceItemType={TraceItemDataset.TRACEMETRICS}
              enabled
            >
              <MetricsDrawer group={group} event={event} project={project} />
            </TraceItemAttributeProvider>
          </TraceViewMetricsDataProvider>
        ),
        {
          ariaLabel: 'metrics drawer',
          drawerKey: 'metrics-issue-drawer',
          shouldCloseOnInteractOutside: element => {
            const viewAllButton = viewAllButtonRef.current;
            return !viewAllButton?.contains(element);
          },
        }
      );
    },
    [group, event, project, openDrawer, organization, traceId]
  );

  if (!feature) {
    return null;
  }

  if (!traceId) {
    // If there isn't a traceId, we shouldn't show metrics since they are trace specific
    return null;
  }

  if (!tableData || tableData.length === 0) {
    // Don't show the metrics section if there are no metrics
    return null;
  }

  return (
    <InterimSection
      key="metrics"
      type={SectionKey.METRICS}
      title={t('Metrics')}
      data-test-id="metrics-data-section"
    >
      <Flex direction="column" gap="xl">
        <MetricsSamplesTable embedded />
        {tableData && tableData.length > 5 ? (
          <div>
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('View more')}
              size="sm"
              onClick={onOpenMetricsDrawer}
              ref={viewAllButtonRef}
            >
              {t('View more')}
            </Button>
          </div>
        ) : null}
      </Flex>
    </InterimSection>
  );
}
