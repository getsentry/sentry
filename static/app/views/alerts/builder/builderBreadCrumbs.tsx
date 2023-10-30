import Breadcrumbs, {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';

interface Props {
  organization: Organization;
  projectSlug: string;
  title: string;
  alertName?: string;
}

function BuilderBreadCrumbs({title, alertName, projectSlug, organization}: Props) {
  const crumbs: (Crumb | CrumbDropdown)[] = [
    {
      to: `/organizations/${organization.slug}/alerts/rules/`,
      label: t('Alerts'),
      preservePageFilters: true,
    },
    {
      label: title,
      ...(alertName
        ? {
            to: `/organizations/${organization.slug}/alerts/${projectSlug}/wizard`,
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
