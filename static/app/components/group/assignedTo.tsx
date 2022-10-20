import {useEffect} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {
  AssigneeSelectorDropdown,
  AssigneeSelectorDropdownProps,
} from 'sentry/components/assigneeSelectorDropdown';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {AutoCompleteRoot} from 'sentry/components/dropdownAutoComplete/menu';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconChevron, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import space from 'sentry/styles/space';
import type {Actor, Group, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface AssignedToProps {
  group: Group;
  projectId: Project['id'];
  onAssign?: AssigneeSelectorDropdownProps['onAssign'];
}

function AssignedTo({group, projectId}: AssignedToProps) {
  const organization = useOrganization();
  const api = useApi();
  useEffect(() => {
    // TODO: We should check if this is already loaded
    fetchOrgMembers(api, organization.slug, [projectId]);
  }, [api, organization.slug, projectId]);

  function getAssignedToDisplayName(assignedTo?: Actor) {
    if (assignedTo?.type === 'team') {
      const team = TeamStore.getById(group.assignedTo.id);
      return `#${team?.slug ?? group.assignedTo.name}`;
    }
    if (assignedTo?.type === 'user') {
      const user = MemberListStore.getById(assignedTo.id);
      return user?.name ?? group.assignedTo.name;
    }

    return group.assignedTo?.name ?? t('No-one');
  }

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('Assigned To')}</SidebarSection.Title>
      <StyledSidebarSectionContent>
        <AssigneeSelectorDropdown id={group.id}>
          {({loading, assignedTo, isOpen, getActorProps}) => (
            <DropdownButton data-test-id="assignee-selector" {...getActorProps({})}>
              <ActorWrapper>
                {loading ? (
                  <StyledLoadingIndicator mini size={24} />
                ) : assignedTo ? (
                  <ActorAvatar
                    data-test-id="assigned-avatar"
                    actor={assignedTo}
                    hasTooltip={false}
                    size={24}
                  />
                ) : (
                  <IconWrapper>
                    <IconUser size="md" />
                  </IconWrapper>
                )}
                <ActorName>{getAssignedToDisplayName(assignedTo)}</ActorName>
              </ActorWrapper>
              <IconChevron direction={isOpen ? 'up' : 'down'} />
            </DropdownButton>
          )}
        </AssigneeSelectorDropdown>
      </StyledSidebarSectionContent>
    </SidebarSection.Wrap>
  );
}

export default AssignedTo;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  max-width: 85%;
  line-height: 1;
`;

const IconWrapper = styled('div')`
  display: flex;
  padding: ${space(0.25)};
`;

const ActorName = styled('div')`
  line-height: 1.2;
  ${p => p.theme.overflowEllipsis}
`;

const StyledSidebarSectionContent = styled(SidebarSection.Content)`
  ${AutoCompleteRoot} {
    display: block;
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  width: 24px;
  height: 24px;
  margin: 0 !important;
`;
