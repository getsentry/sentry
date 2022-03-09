import styled from '@emotion/styled';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import {tn} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';

type Props = {
  organization: OrganizationSummary;
  /**
   * Show the project count under the organization name.
   */
  projectCount?: number;
};

const SidebarOrgSummary = ({organization, projectCount}: Props) => (
  <OrgSummary>
    <OrganizationAvatar organization={organization} size={36} />
    <Details>
      <Name>{organization.name}</Name>
      {!!projectCount && <Extra>{tn('%s project', '%s projects', projectCount)}</Extra>}
    </Details>
  </OrgSummary>
);

const OrgSummary = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${p => p.theme.sidebar.menuSpacing};
  overflow: hidden;
`;

const Details = styled('div')`
  overflow: hidden;
`;

const Name = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.1;
  font-weight: bold;
  ${overflowEllipsis};
`;

const Extra = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
  margin-top: ${space(0.5)};
  ${overflowEllipsis};
`;

// Needed for styling in SidebarMenuItem
export {OrgSummary};

export default SidebarOrgSummary;
