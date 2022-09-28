import {PlainRoute} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Breadcrumbs, {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

interface Props {
  location: Location;
  organization: Organization;
  projectSlug: string;
  routes: PlainRoute[];
  title: string;
  alertName?: string;
  alertType?: string;
  canChangeProject?: boolean;
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

  return <StyledBreadcrumbs crumbs={crumbs} />;
}

const StyledBreadcrumbs = styled(Breadcrumbs)`
  font-size: 18px;
  margin-bottom: ${space(3)};
`;

export default BuilderBreadCrumbs;
