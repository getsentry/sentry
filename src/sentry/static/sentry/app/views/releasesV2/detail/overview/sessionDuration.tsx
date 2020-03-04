import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';

import UsersChart from '../../list/usersChart';
import {mockData} from '../../list/mock';

type Props = {};

const SessionDuration = ({}: Props) => {
  return (
    <Wrapper>
      <SectionHeading>{t('Session Duration')}</SectionHeading>
      <UsersChart
        data={{'24h': mockData[0].graphData['24h'].slice(0, 15)}}
        statsPeriod="24h"
        height={50}
      />
    </Wrapper>
  );
};

const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  padding-right: ${space(1)};
  line-height: 1.2;
`;

const Wrapper = styled('div')`
  margin-bottom: ${space(4)};
  g > .barchart-rect {
    background: ${p => p.theme.offWhite2};
    fill: ${p => p.theme.offWhite2};
  }
`;

export default SessionDuration;
