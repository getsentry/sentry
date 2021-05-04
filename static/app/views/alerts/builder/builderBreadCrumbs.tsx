import styled from '@emotion/styled';

import Breadcrumbs, {Crumb} from 'app/components/breadcrumbs';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  hasMetricAlerts: boolean;
  orgSlug: string;
  title: string;
  projectSlug: string;
  alertName?: string;
};

function BuilderBreadCrumbs(props: Props) {
  const {hasMetricAlerts, orgSlug, title, alertName, projectSlug} = props;
  const crumbs: Crumb[] = [
    {
      to: hasMetricAlerts
        ? `/organizations/${orgSlug}/alerts/`
        : `/organizations/${orgSlug}/alerts/rules/`,
      label: t('Alerts'),
      preserveGlobalSelection: true,
    },
    {
      label: title,
      ...(alertName
        ? {
            to: `/organizations/${orgSlug}/alerts/${projectSlug}/wizard`,
            preserveGlobalSelection: true,
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
