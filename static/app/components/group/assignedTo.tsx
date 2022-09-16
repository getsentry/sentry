import {useEffect} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {AssigneeSelectorDropdown} from 'sentry/components/assigneeSelectorDropdown';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {AutoCompleteRoot} from 'sentry/components/dropdownAutoComplete/menu';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconChevron, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Group, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface AssignedToProps {
  group: Group;
  projectId: Project['id'];
}

function AssignedTo({group, projectId}: AssignedToProps) {
  const organization = useOrganization();
  const api = useApi();
  useEffect(() => {
    fetchOrgMembers(api, organization.slug, [projectId]);
  }, [api, organization.slug, projectId]);

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('Assigned To')}</SidebarSection.Title>
      <StyledSidebarSectionContent>
        <AssigneeSelectorDropdown id={group.id}>
          {({loading, isOpen, getActorProps}) => (
            <DropdownButton data-test-id="assignee-selector" {...getActorProps({})}>
              <ActorWrapper>
                {loading ? (
                  <StyledLoadingIndicator mini size={20} />
                ) : group.assignedTo ? (
                  <ActorAvatar
                    hasTooltip={false}
                    actor={group.assignedTo}
                    data-test-id="owner-avatar"
                    size={20}
                  />
                ) : (
                  <IconUser size="md" />
                )}
                {group.assignedTo?.type === 'team'
                  ? `#${group.assignedTo.name}`
                  : group.assignedTo?.name ?? t('No-one')}
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
`;

const StyledSidebarSectionContent = styled(SidebarSection.Content)`
  ${AutoCompleteRoot} {
    display: block;
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  height: 20px;
  width: 20px;
  margin: 0;
`;
