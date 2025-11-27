import {useCallback, useEffect, useRef} from 'react';

import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {MetricsDrawer} from 'sentry/components/events/metrics/metricsDrawer';
import {useMetricsIssueSection} from 'sentry/components/events/metrics/useMetricsIssueSection';
import useDrawer from 'sentry/components/globalDrawer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {METRICS_DRAWER_QUERY_PARAM} from 'sentry/views/explore/metrics/constants';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceViewMetricsProviderWrapper} from 'sentry/views/performance/newTraceDetails/traceMetrics';

import {NUMBER_ABBREVIATED_METRICS} from './useMetricsIssueSection';

export function MetricsSection({
  event,
  project,
  group,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const organization = useOrganization();
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
    // If there isn't a traceId, we shouldn't show metrics since they are trace specific
    return null;
  }

  if (!canUseMetricsUI(organization)) {
    return null;
  }

  return (
    <TraceViewMetricsProviderWrapper traceSlug={traceId}>
      <MetricsSectionContent
        event={event}
        group={group}
        project={project}
        traceId={traceId}
      />
    </TraceViewMetricsProviderWrapper>
  );
}

function MetricsSectionContent({
  event,
  project,
  group,
  traceId,
}: {
  event: Event;
  group: Group;
  project: Project;
  traceId: string;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const {result, error} = useMetricsIssueSection({traceId});
  const abbreviatedTableData = result.data
    ? result.data.slice(0, NUMBER_ABBREVIATED_METRICS)
    : undefined;

  const onOpenMetricsDrawer = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      trackAnalytics('metrics.issue_details.drawer_opened', {
        organization,
      });

      navigate(
        {
          ...location,
          query: {
            ...location.query,
            [METRICS_DRAWER_QUERY_PARAM]: 'true',
          },
        },
        {replace: true}
      );
    },
    [navigate, location, organization]
  );

  useEffect(() => {
    const shouldOpenDrawer = location.query[METRICS_DRAWER_QUERY_PARAM] === 'true';
    if (shouldOpenDrawer) {
      openDrawer(
        () => (
          <TraceViewMetricsProviderWrapper traceSlug={traceId}>
            <TraceItemAttributeProvider
              traceItemType={TraceItemDataset.TRACEMETRICS}
              enabled
            >
              <MetricsDrawer group={group} event={event} project={project} />
            </TraceItemAttributeProvider>
          </TraceViewMetricsProviderWrapper>
        ),
        {
          ariaLabel: 'metrics drawer',
          drawerKey: 'metrics-issue-drawer',
          shouldCloseOnInteractOutside: element => {
            const viewAllButton = viewAllButtonRef.current;
            return !viewAllButton?.contains(element);
          },
          onClose: () => {
            navigate(
              {
                ...location,
                query: {
                  ...location.query,
                  [METRICS_DRAWER_QUERY_PARAM]: undefined,
                },
              },
              {replace: true}
            );
          },
        }
      );
    }
  }, [location.query, traceId, group, event, project, openDrawer, navigate, location]);

  if (!result.data || result.data.length === 0 || error) {
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
        <MetricsSamplesTable embedded overrideTableData={abbreviatedTableData} />
        {result.data && result.data.length > NUMBER_ABBREVIATED_METRICS ? (
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
