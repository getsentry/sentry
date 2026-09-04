import type {Crumb} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

interface Props {
  organization: Organization;
  projectSlug: string;
  title: string;
}

export function BuilderBreadCrumbs({title, organization}: Props) {
  const crumbs: Crumb[] = [
    {
      to: makeMonitorBasePathname(organization.slug),
      label: t('Monitors'),
      preservePageFilters: true,
    },
    {
      label: title,
    },
  ];

  return <Breadcrumbs crumbs={crumbs} />;
}
