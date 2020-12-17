import React from 'react';
import styled from '@emotion/styled';

import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {displayCrashFreePercent} from '../utils';

const CRASH_FREE_DANGER_THRESHOLD = 98;
const CRASH_FREE_WARNING_THRESHOLD = 99.5;

const getIcon = (percent: number) => {
  if (percent < CRASH_FREE_DANGER_THRESHOLD) {
    return <IconFire color="red300" />;
  }

  if (percent < CRASH_FREE_WARNING_THRESHOLD) {
    return <IconWarning color="yellow300" />;
  }

  return <IconCheckmark isCircled color="green300" />;
};

type Props = {
  percent: number;
};

const CrashFree = ({percent}: Props) => {
  return (
    <Wrapper>
      {getIcon(percent)}
      <CrashFreePercent>{displayCrashFreePercent(percent)}</CrashFreePercent>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
`;

const CrashFreePercent = styled('div')`
  ${overflowEllipsis};
`;

export default CrashFree;
