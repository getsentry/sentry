import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import ActorAvatar from 'app/components/avatar/actorAvatar';
import SuggestedOwnerHovercard from 'app/components/group/suggestedOwnerHovercard';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Actor, Commit} from 'app/types';

import SidebarSection from '../sidebarSection';

type Owner = {
  actor: Actor;
  commits?: Array<Commit>;
  rules?: Array<any> | null;
};

type Props = {
  owners: Array<Owner>;
  onAssign: (actor: Actor) => () => void;
};

const SuggestedAssignees = ({owners, onAssign}: Props) => (
  <SidebarSection
    title={
      <React.Fragment>
        {t('Suggested Assignees')}
        <Subheading>{t('Click to assign')}</Subheading>
      </React.Fragment>
    }
  >
    <Content>
      {owners.map((owner, i) => (
        <SuggestedOwnerHovercard
          key={`${owner.actor.id}:${owner.actor.email}:${owner.actor.name}:${i}`}
          {...owner}
        >
          <ActorAvatar
            css={css`
              cursor: pointer;
            `}
            onClick={onAssign(owner.actor)}
            hasTooltip={false}
            actor={owner.actor}
          />
        </SuggestedOwnerHovercard>
      ))}
    </Content>
  </SidebarSection>
);

export {SuggestedAssignees};

const Subheading = styled('small')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray300};
  line-height: 100%;
  font-weight: 400;
  margin-left: ${space(0.5)};
`;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: repeat(auto-fill, 20px);
`;
