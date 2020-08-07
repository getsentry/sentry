import React from 'react';
import styled from '@emotion/styled';

import {Badge} from 'app/types';
import Button from 'app/components/button';
import {triggerBadgeAlert} from 'app/actionCreators/badges';
import space from 'app/styles/space';
import {IconAdd, IconLock} from 'app/icons';
import ButtonBar from 'app/components/buttonBar';

type Props = {
  badge: Badge;
  closeModal: () => void;
};

const BadgeModal = ({badge, closeModal}: Props) => {
  return (
    <Container>
      <Icon>
        <badge.icon />
      </Icon>
      <h1>{badge.title}</h1>
      {badge.flavor && <Flavor>{badge.flavor}</Flavor>}
      <Desc>{badge.description}</Desc>

      <ButtonBar gap={2}>
        <Button
          size="small"
          icon={<IconAdd isCircled />}
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            `I unlocked a Sentry Achivmment! ${badge.title}. <LINK HERE>`
          )}`}
        >
          Share on Twitter!
        </Button>
        <Button
          priority="primary"
          size="small"
          icon={<IconLock />}
          onClick={() => {
            badge.unlocked = true;
            triggerBadgeAlert(badge);
            closeModal();
          }}
        >
          Unlock
        </Button>
      </ButtonBar>
    </Container>
  );
};

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;

  h1 {
    font-size: 24px;
  }
`;

const Flavor = styled('div')`
  color: ${p => p.theme.purple400};
  font-style: italic;
  margin-bottom: ${space(1)};
  margin-top: ${space(1)};
  font-size: 15px;
  text-align: center;

  &:before,
  &:after {
    content: '"';
  }
`;

const Desc = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: 14px;
  text-transform: uppercase;
  margin-bottom: ${space(3)};
  margin-top: ${space(1)};
  text-align: center;
  font-weight: bold;
`;

const Icon = styled('div')`
  width: 260px;
`;

export default BadgeModal;
