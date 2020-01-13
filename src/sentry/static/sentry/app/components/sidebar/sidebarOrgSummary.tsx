import React from 'react';
import styled from '@emotion/styled';

import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Organization} from 'app/types';
import {tn} from 'app/locale';

type Props = {
  organization: Organization;
};

const SidebarOrgSummary: React.FC<Props> = ({organization}) => {
  const projects = organization.projects && organization.projects.length;
  const extra: string[] = [];

  if (projects) {
    extra.push(tn('%d project', '%d projects', projects));
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

SidebarOrgSummary.propTypes = {
  organization: SentryTypes.Organization,
};

const OrgSummary = styled('div')`
  display: flex;
  padding: 10px 15px;
  overflow: hidden;
`;
const SummaryOrgName = styled('div')`
  color: ${p => p.theme.gray5};
  font-size: 16px;
  line-height: 1.1;
  font-weight: bold;
  margin-bottom: 4px;
  ${overflowEllipsis};
`;
const SummaryOrgDetails = styled('div')`
  color: ${p => p.theme.gray3};
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
