import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import SuggestedOwnerHovercard from 'sentry/components/group/suggestedOwnerHovercard';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Actor, Commit} from 'sentry/types';

import SidebarSection from '../sidebarSection';

type Owner = {
  actor: Actor;
  commits?: Array<Commit>;
  rules?: Array<any> | null;
};

type Props = {
  onAssign: (actor: Actor) => () => void;
  owners: Array<Owner>;
};

const SuggestedAssignees = ({owners, onAssign}: Props) => (
  <SidebarSection
    title={
      <Fragment>
        {t('Suggested Assignees')}
        <Subheading>{t('Click to assign')}</Subheading>
      </Fragment>
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
            data-test-id="suggested-assignee"
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
  gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 20px);
`;
