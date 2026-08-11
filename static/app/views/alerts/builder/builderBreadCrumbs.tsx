import type {Crumb} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

interface Props {
  organization: Organization;
  projectSlug: string;
  title: string;
  alertName?: string;
}

export function BuilderBreadCrumbs({title, alertName, projectSlug, organization}: Props) {
  const crumbs: Crumb[] = [
    {
      to: makeMonitorBasePathname(organization.slug),
      label: t('Monitors'),
      preservePageFilters: true,
    },
    {
      label: title,
      ...(alertName
        ? {
            to: makeAlertsPathname({
              path: `/${projectSlug}/wizard/`,
              organization,
            }),
            preservePageFilters: true,
          }
        : {}),
    },
  ];
  if (alertName) {
    crumbs.push({label: alertName});
  }

  return <Breadcrumbs crumbs={crumbs} />;
}
