import {useCallback} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Button from 'sentry/components/button';
import SuggestedOwnerHovercard from 'sentry/components/group/suggestedOwnerHovercard';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Actor, Commit, Group, Organization, Release} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

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
  projectId?: string;
};

const SuggestedAssignees = ({
  group,
  owners,
  projectId,
  organization,
  onAssign,
}: Props) => {
  const handleAssign = useCallback(
    (owner: Owner) => {
      onAssign(owner.actor);
      trackAdvancedAnalyticsEvent('issue_details.action_clicked', {
        organization,
        project_id: parseInt(projectId!, 10),
        group_id: parseInt(group.id, 10),
        issue_category: group.issueCategory,
        action_type: 'assign',
        assigned_suggestion_reason: owner.source,
      });
    },
    [onAssign, group.id, group.issueCategory, projectId, organization]
  );

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
                        : owner.actor.name}
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
  padding-right: 0;
`;
