import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Image} from '@sentry/scraps/image';
import {Stack} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DashboardFilterKeys} from 'sentry/views/dashboards/types';
import {getDashboardFiltersFromURL} from 'sentry/views/dashboards/utils';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  bucketsKeepThresholds,
  getBucketsFromGlobalFilters,
  NAVIGATION_TYPE_BUCKETS,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';
import {useNavigationTypeCounts} from 'sentry/views/insights/browser/webVitals/navigationType/useNavigationTypeCounts';
import {
  getSwitcherFilter,
  useNavigationTypeExperiment,
} from 'sentry/views/insights/browser/webVitals/navigationType/utils';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';

interface Props {
  children: React.ReactNode;
  prebuiltId?: PrebuiltDashboardId;
}

/**
 * The banner shows exactly when thresholds are hidden, copies included. The
 * empty state takes over the whole grid and only counts web vitals spans, so it
 * stays off outside the web vitals dashboards.
 */
export function NavigationTypeGate({children, prebuiltId}: Props) {
  const organization = useOrganization();
  const {isEnabled: isWebVitalsDashboard, otherSpanFilterQuery} =
    useNavigationTypeExperiment(prebuiltId);
  const location = useLocation();

  const switcherFilter = getSwitcherFilter(
    getDashboardFiltersFromURL(location)?.[DashboardFilterKeys.GLOBAL_FILTER],
    organization
  );
  const buckets = switcherFilter ? getBucketsFromGlobalFilters([switcherFilter]) : [];
  const hidesThresholds = Boolean(switcherFilter) && !bucketsKeepThresholds(buckets);

  const {counts, isPending} = useNavigationTypeCounts({
    additionalQuery: otherSpanFilterQuery,
    enabled: hidesThresholds && isWebVitalsDashboard,
  });

  if (!hidesThresholds) {
    return children;
  }

  const labels = buckets.map(bucket => NAVIGATION_TYPE_BUCKETS[bucket].label());
  const selectedCount = buckets.reduce((total, bucket) => total + counts[bucket], 0);

  if (isWebVitalsDashboard && !isPending && selectedCount === 0) {
    return (
      <Panel>
        <EmptyState
          padding="3xl"
          illustration={<Image src={emptyStateImg} alt="" width="240px" />}
          title={t('No %s in this period', oxfordizeArray(labels).toLowerCase())}
          description={buckets
            .map(bucket => NAVIGATION_TYPE_BUCKETS[bucket].emptyReason())
            .join(' ')}
          action={
            <LinkButton external href={MODULE_DOC_LINK}>
              {t('Read the Docs')}
            </LinkButton>
          }
        />
      </Panel>
    );
  }

  return (
    <Stack gap="lg">
      <Alert variant="info" showIcon>
        {buckets.length === 1
          ? tct(
              '[label] are not comparable to page loads. The good/needs improvement/poor thresholds and the performance scores on this page were derived from page load data, so thresholds are hidden here and the numbers should be read raw.',
              {label: <strong>{labels[0]}</strong>}
            )
          : tct(
              'You are looking at [labels] together. A p75 across navigation types is a blend rather than one measurement, so thresholds are hidden. The performance scores on this page are still calibrated for page loads.',
              {labels: <strong>{oxfordizeArray(labels)}</strong>}
            )}
      </Alert>
      {children}
    </Stack>
  );
}
