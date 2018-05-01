import React from 'react';
import styled from 'react-emotion';

import Avatar from 'app/components/avatar';
import SentryTypes from 'app/proptypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';

class SidebarOrgSummary extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    let {organization} = this.props;
    let projects = organization.projects && organization.projects.length;
    let extra = [];

    if (projects) {
      extra.push(`${projects} projects`);
    }

    return (
      <OrgSummary>
        <Avatar css={{flexShrink: 0}} organization={organization} size={36} />

        <Details>
          <SummaryOrgName>{organization.name}</SummaryOrgName>
          {!!extra.length && <SummaryOrgDetails>{extra.join(', ')}</SummaryOrgDetails>}
        </Details>
      </OrgSummary>
    );
  }
}

export default SidebarOrgSummary;

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
