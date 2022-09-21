import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Button from 'sentry/components/button';
import SuggestedOwnerHovercard from 'sentry/components/group/suggestedOwnerHovercard';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Actor, Commit, Organization, Release} from 'sentry/types';

type Owner = {
  actor: Actor;
  commits?: Array<Commit>;
  release?: Release;
  rules?: Array<any> | null;
};

type Props = {
  onAssign: (actor: Actor) => () => void;
  organization: Organization;
  owners: Array<Owner>;
  projectId?: string;
};

const SuggestedAssignees = ({owners, projectId, organization, onAssign}: Props) => (
  <SidebarSection.Wrap>
    <SidebarSection.Title>
      <Fragment>
        {t('Suggested Assignees')}
        <Subheading>{t('Click to assign')}</Subheading>
      </Fragment>
    </SidebarSection.Title>
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

            <Button
              role="button"
              size="zero"
              borderless
              aria-label={t('Assign')}
              icon={<IconCheckmark />}
              disabled={owner.actor.id === undefined}
              onClick={onAssign(owner.actor)}
            />
          </SuggestionRow>
        ))}
      </Content>
    </SidebarSection.Content>
  </SidebarSection.Wrap>
);

export {SuggestedAssignees};

const Subheading = styled('small')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray300};
  line-height: 100%;
  font-weight: 400;
  margin-left: ${space(0.5)};
  align-self: center;
`;

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
