import {useCallback} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Button} from 'sentry/components/button';
import SuggestedOwnerHovercard from 'sentry/components/group/suggestedOwnerHovercard';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Actor, Commit, Group, Organization, Release} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';

type Owner = {
  actor: Actor;
  source: 'codeowners' | 'projectOwnership' | 'suspectCommit';
  commits?: Array<Commit>;
  release?: Release;
  rules?: Array<any> | null;
};

type Props = {
  group: Group;
  onAssign: (actor: Actor) => void;
  organization: Organization;
  owners: Array<Owner>;
  loading?: boolean;
  projectId?: string;
};

const SuggestedAssignees = ({
  group,
  owners,
  projectId,
  organization,
  loading,
  onAssign,
}: Props) => {
  const handleAssign = useCallback(
    (owner: Owner) => {
      onAssign(owner.actor);
      trackAdvancedAnalyticsEvent('issue_details.action_clicked', {
        organization,
        project_id: parseInt(projectId!, 10),
        action_type: 'assign',
        assigned_suggestion_reason: owner.source,
        ...getAnalyticsDataForGroup(group),
      });
    },
    [onAssign, organization, projectId, group]
  );

  if (loading) {
    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('Suggested Assignees')}</SidebarSection.Title>
        <SidebarSection.Content>
          <Placeholder />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

  if (!owners.length) {
    return null;
  }

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('Suggested Assignees')}</SidebarSection.Title>
      <SidebarSection.Content>
        <Content>
          {owners.map((owner, i) => (
            <SuggestionRow
              key={`${owner.actor.id}:${owner.actor.email}:${owner.actor.name}:${i}`}
            >
              <ActorMaxWidth>
                <SuggestedOwnerHovercard
                  projectId={projectId}
                  organization={organization}
                  {...owner}
                >
                  <ActorWrapper>
                    <ActorAvatar
                      hasTooltip={false}
                      actor={owner.actor}
                      data-test-id="suggested-assignee"
                      size={20}
                    />
                    <ActorName>
                      {owner.actor.type === 'team'
                        ? `#${owner.actor.name}`
                        : owner.actor.name || owner.actor.email || t('Unknown author')}
                    </ActorName>
                  </ActorWrapper>
                </SuggestedOwnerHovercard>
              </ActorMaxWidth>

              <StyledButton
                role="button"
                size="zero"
                borderless
                aria-label={t('Assign')}
                icon={<IconCheckmark />}
                disabled={owner.actor.id === undefined}
                onClick={() => handleAssign(owner)}
              />
            </SuggestionRow>
          ))}
        </Content>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
};

export {SuggestedAssignees};

const Content = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;

const ActorMaxWidth = styled('div')`
  max-width: 85%;
`;

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const ActorName = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

const SuggestionRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledButton = styled(Button)`
  /* Matches button padding so the icon lines up with others in sidebar */
  margin-right: -2px;
`;
