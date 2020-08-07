import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import DateTime from 'app/components/dateTime';
import space from 'app/styles/space';
import {Achievement} from 'app/types';

import getAchievementDetails from './getAchievementDetails';

type Props = {
  achievement: Achievement;
};

const Card = ({achievement}: Props) => {
  const {title, img} = getAchievementDetails(achievement.type);
  return (
    <Wrapper>
      {img}
      <Title>{title}</Title>
      {tct('Unlock [on]', {
        on: <DateTime date={achievement.dateUnlock} dateOnly />,
      })}
    </Wrapper>
  );
};

export default Card;

const Wrapper = styled('div')`
  background: ${p => p.theme.white};
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
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray700};
  font-weight: 600;
  margin-bottom: ${space(1)};
`;
