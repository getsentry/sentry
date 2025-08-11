import type {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

interface Props {
  organization: Organization;
  projectSlug: string;
  title: string;
  alertName?: string;
}

function BuilderBreadCrumbs({title, alertName, projectSlug, organization}: Props) {
  const crumbs: Array<Crumb | CrumbDropdown> = [
    {
      to: makeAlertsPathname({
        path: '/rules/',
        organization,
      }),
      label: t('Alerts'),
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

export default BuilderBreadCrumbs;
