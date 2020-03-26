import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';

import HealthStatsChart from '../../list/healthStatsChart';
import {mockData} from '../../list/mock';
import {SectionHeading, Wrapper} from './styles';

type Props = {};

// TODO(releasesV2): waiting for API
const SessionDuration = ({}: Props) => (
  <StyledWrapper>
    <SectionHeading>{t('Session Duration')}</SectionHeading>
    <HealthStatsChart
      data={{'24h': mockData[0].graphData['24h'].slice(0, 15)}}
      period="24h"
      subject="sessions"
      height={50}
    />
  </StyledWrapper>
);

const StyledWrapper = styled(Wrapper)`
  /* TODO(releasesV2): this will be changed */
  g > .barchart-rect {
    background: ${p => p.theme.offWhite2};
    fill: ${p => p.theme.offWhite2};
  }
`;

export default SessionDuration;
