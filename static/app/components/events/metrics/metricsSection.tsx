import {useEffect, useRef} from 'react';

import {Button} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';

import {ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS} from 'sentry/components/events/issueDetailsLazyRender';
import {MetricsDrawer} from 'sentry/components/events/metrics/metricsDrawer';
import {useMetricsIssueSection} from 'sentry/components/events/metrics/useMetricsIssueSection';
import {LazyRender} from 'sentry/components/lazyRender';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {METRICS_DRAWER_QUERY_PARAM} from 'sentry/views/explore/metrics/constants';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
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
  const location = useLocation();
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
    return null;
  }

  if (!canUseMetricsUI(organization)) {
    return null;
  }

  return (
    <LazyRender
      disabled={
        location.query[METRICS_DRAWER_QUERY_PARAM] === 'true' ||
        location.hash === `#${SectionKey.METRICS}`
      }
      observerOptions={ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS}
      withoutContainer
    >
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <MetricsSectionContent
          event={event}
          group={group}
          project={project}
          traceId={traceId}
        />
      </TraceViewMetricsProviderWrapper>
    </LazyRender>
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

  const onOpenMetricsDrawer = (e: React.MouseEvent) => {
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
  };

  useEffect(() => {
    const shouldOpenDrawer = location.query[METRICS_DRAWER_QUERY_PARAM] === 'true';
    if (shouldOpenDrawer) {
      openDrawer(
        () => (
          <TraceViewMetricsProviderWrapper traceSlug={traceId}>
            <MetricsDrawer group={group} event={event} project={project} />
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
    <FoldSection sectionKey={SectionKey.METRICS} title={t('Application Metrics')}>
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
    </FoldSection>
  );
}
