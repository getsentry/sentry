import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import SuggestedOwnerHovercard from 'sentry/components/group/suggestedOwnerHovercard';
import * as SidebarSection from 'sentry/components/sidebarSection';
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
          <SuggestedOwnerHovercard
            key={`${owner.actor.id}:${owner.actor.email}:${owner.actor.name}:${i}`}
            projectId={projectId}
            organization={organization}
            {...owner}
          >
            <ActorAvatar
              css={css`
                cursor: pointer;
              `}
              onClick={onAssign(owner.actor)}
              hasTooltip={false}
              actor={owner.actor}
              data-test-id="suggested-assignee"
            />
          </SuggestedOwnerHovercard>
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
  display: grid;
  gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 20px);
`;
