import styled from '@emotion/styled';

import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Organization, OrganizationSummary} from 'app/types';
import {tn} from 'app/locale';

type Props = {
  organization: OrganizationSummary;
};

const SidebarOrgSummary = ({organization}: Props) => {
  const fullOrg = organization as Organization;
  const projects = fullOrg.projects && fullOrg.projects.length;
  const extra: string[] = [];

  if (projects) {
    extra.push(tn('%s project', '%s projects', projects));
  }

  return (
    <OrgSummary>
      <OrganizationAvatar organization={organization} size={36} />

      <Details>
        <SummaryOrgName>{organization.name}</SummaryOrgName>
        {!!extra.length && <SummaryOrgDetails>{extra.join(', ')}</SummaryOrgDetails>}
      </Details>
    </OrgSummary>
  );
};

const OrgSummary = styled('div')`
  display: flex;
  padding: 10px 15px;
  overflow: hidden;
`;
const SummaryOrgName = styled('div')`
  color: ${p => p.theme.gray800};
  font-size: 16px;
  line-height: 1.1;
  font-weight: bold;
  margin-bottom: 4px;
  ${overflowEllipsis};
`;
const SummaryOrgDetails = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: 14px;
  line-height: 1;
  ${overflowEllipsis};
`;
const Details = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;

  padding-left: 10px;
  overflow: hidden;
`;

// Needed for styling in SidebarMenuItem
export {OrgSummary};
export default SidebarOrgSummary;
