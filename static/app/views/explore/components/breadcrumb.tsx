import type {Crumb} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeLogsPathname} from 'sentry/views/explore/logs/utils';
import {makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

function ExploreBreadcrumb({traceItemDataset}: {traceItemDataset: TraceItemDataset}) {
  const organization = useOrganization();
  const crumbs: Crumb[] = [];
  if (traceItemDataset === TraceItemDataset.SPANS) {
    crumbs.push({
      to: makeTracesPathname({organization, path: '/'}),
      label: t('Traces'),
    });
  }
  if (traceItemDataset === TraceItemDataset.LOGS) {
    crumbs.push({
      to: makeLogsPathname({organizationSlug: organization.slug, path: '/'}),
      label: t('Logs'),
    });
  }
  if (traceItemDataset === TraceItemDataset.TRACEMETRICS) {
    crumbs.push({
      to: makeMetricsPathname({organizationSlug: organization.slug, path: '/'}),
      label: t('Metrics'),
    });
  }
  if (traceItemDataset === TraceItemDataset.REPLAYS) {
    crumbs.push({
      to: makeReplaysPathname({organization, path: '/'}),
      label: t('Replays'),
    });
  }
  crumbs.push({
    label: t('Saved Query'),
  });

  return <Breadcrumbs crumbs={crumbs} />;
}

export default ExploreBreadcrumb;
