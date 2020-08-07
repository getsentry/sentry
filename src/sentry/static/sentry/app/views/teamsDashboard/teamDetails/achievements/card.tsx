import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import DateTime from 'app/components/dateTime';
import space from 'app/styles/space';
import {Achievement} from 'app/types';

import getAchievementDetails from './getAchievementDetails';

type Props = {
  achievement: Achievement;
  isDisabled?: boolean;
};

const Card = ({achievement, isDisabled = false}: Props) => {
  const {title, img} = getAchievementDetails(achievement.type);
  return (
    <Wrapper isDisabled={isDisabled}>
      {img}
      <Title>{title}</Title>
      {tct('Unlock [on]', {
        on: <DateTime date={achievement.dateUnlock} dateOnly />,
      })}
    </Wrapper>
  );
};

export default Card;

const Wrapper = styled('div')<{isDisabled: boolean}>`
  border: 1px solid ${p => p.theme.gray400};
  box-shadow: 0px 2px 1px rgba(0, 0, 0, 0.08);
  border-radius: ${p => p.theme.borderRadius};
  height: 257px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  background: ${p => p.theme.white};
  ${p =>
    p.isDisabled &&
    `
    background: ${p.theme.gray200};
    opacity: 0.5;
  `}
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray700};
  font-weight: 600;
  margin-bottom: ${space(1)};
`;
