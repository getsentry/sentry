import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeLogsPathname} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
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
  crumbs.push({
    label: t('Saved Query'),
  });

  return <Breadcrumbs crumbs={crumbs} />;
}

export default ExploreBreadcrumb;
