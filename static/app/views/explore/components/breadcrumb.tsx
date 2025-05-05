import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

function ExploreBreadcrumb() {
  const organization = useOrganization();
  const crumbs: Crumb[] = [];
  crumbs.push({
    to: makeTracesPathname({organization, path: '/'}),
    label: t('Traces'),
  });
  crumbs.push({
    label: t('Saved Query'),
  });

  return <Breadcrumbs crumbs={crumbs} />;
}

export default ExploreBreadcrumb;
