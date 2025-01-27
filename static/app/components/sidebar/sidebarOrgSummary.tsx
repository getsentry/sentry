import styled from '@emotion/styled';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import {IconWarning} from 'sentry/icons';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OrganizationSummary} from 'sentry/types/organization';

type Props = {
  organization: OrganizationSummary;
  className?: string;
  /**
   * Show the project count under the organization name.
   */
  projectCount?: number;
};

const SidebarOrgSummary = styled(({organization, projectCount, ...props}: Props) => (
  <div {...props}>
    {organization.status.id === 'pending_deletion' ? (
      <PendingDeletionAvatar data-test-id="pending-deletion-icon">
        <IconWarning size="sm" color="gray200" />
      </PendingDeletionAvatar>
    ) : (
      <OrganizationAvatar organization={organization} size={36} />
    )}
    <div>
      <Name pendingDeletion={organization.status.id === 'pending_deletion'}>
        {organization.name}
      </Name>
      {!!projectCount && (
        <ProjectCount>{tn('%s project', '%s projects', projectCount)}</ProjectCount>
      )}
    </div>
  </div>
))`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${p => p.theme.sidebar.menuSpacing};
`;

const Name = styled('div')<{pendingDeletion: boolean}>`
  color: ${p => (p.pendingDeletion ? p.theme.subText : p.theme.textColor)};
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.1;
  font-weight: ${p => p.theme.fontWeightBold};
  ${p => p.theme.overflowEllipsis};
`;

const ProjectCount = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
  margin-top: ${space(0.5)};
  ${p => p.theme.overflowEllipsis};
`;

const PendingDeletionAvatar = styled('div')`
  height: 36px;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed ${p => p.theme.gray200};
  border-radius: 4px;
`;

export default SidebarOrgSummary;
