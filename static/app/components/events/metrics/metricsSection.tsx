import {useEffect, useRef} from 'react';
import {IconChevron} from '@sentry/icons/chevron';
import {createLoader, parseAsBoolean, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';

import {ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS} from 'sentry/components/events/issueDetailsLazyRender';
import {LazyRender} from 'sentry/components/lazyRender';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {METRICS_DRAWER_QUERY_PARAM} from 'sentry/views/explore/metrics/constants';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {TraceViewMetricsProviderWrapper} from 'sentry/views/performance/traceDetails/traceMetrics';

import {MetricsDrawer} from './metricsDrawer';
import {
  useMetricsIssueSection,
  NUMBER_ABBREVIATED_METRICS,
} from './useMetricsIssueSection';

const metricsDrawerParser = parseAsBoolean.withDefault(false);
const loadMetricsDrawerParam = createLoader({
  [METRICS_DRAWER_QUERY_PARAM]: metricsDrawerParser,
});

export function MetricsSection({event}: {event: Event}) {
  const organization = useOrganization();
  const location = useLocation();
  const [isDrawerInUrl] = useQueryState(METRICS_DRAWER_QUERY_PARAM, metricsDrawerParser);
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
    return null;
  }

  if (!canUseMetricsUI(organization)) {
    return null;
  }

  return (
    <LazyRender
      disabled={isDrawerInUrl || location.hash === `#${SectionKey.METRICS}`}
      observerOptions={ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS}
      withoutContainer
    >
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <MetricsSectionContent event={event} traceId={traceId} />
      </TraceViewMetricsProviderWrapper>
    </LazyRender>
  );
}

function MetricsSectionContent({event, traceId}: {event: Event; traceId: string}) {
  const organization = useOrganization();
  const [isDrawerInUrl, setIsDrawerInUrl] = useQueryState(
    METRICS_DRAWER_QUERY_PARAM,
    metricsDrawerParser
  );
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

    setIsDrawerInUrl(true);
  };

  useEffect(() => {
    if (isDrawerInUrl) {
      openDrawer(
        () => (
          <TraceViewMetricsProviderWrapper traceSlug={traceId}>
            <MetricsDrawer event={event} />
          </TraceViewMetricsProviderWrapper>
        ),
        {
          ariaLabel: 'metrics drawer',
          drawerKey: 'metrics-issue-drawer',
          shouldCloseOnLocationChange: nextLocation =>
            !loadMetricsDrawerParam(nextLocation.search ?? '')[
              METRICS_DRAWER_QUERY_PARAM
            ],
          shouldCloseOnInteractOutside: element => {
            const viewAllButton = viewAllButtonRef.current;
            return !viewAllButton?.contains(element);
          },
          onClose: () => {
            setIsDrawerInUrl(false);
          },
        }
      );
    }
  }, [isDrawerInUrl, traceId, event, openDrawer, setIsDrawerInUrl]);

  if (!result.data || result.data.length === 0 || error) {
    return null;
  }

  return (
    <FoldSection sectionKey={SectionKey.METRICS} title={t('Application Metrics')}>
      <Stack gap="xl">
        <MetricsSamplesTable
          source="issueDetails"
          overrideTableData={abbreviatedTableData}
          overrideTableRoutingHint={result.meta?.routingHint}
        />
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
      </Stack>
    </FoldSection>
  );
}
