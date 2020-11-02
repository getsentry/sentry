import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {IconFire, IconWarning, IconCheckmark} from 'app/icons';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import {displayCrashFreePercent} from '../utils';

const CRASH_FREE_DANGER_THRESHOLD = 98;
const CRASH_FREE_WARNING_THRESHOLD = 99.5;

const getIcon = (percent: number) => {
  if (percent < CRASH_FREE_DANGER_THRESHOLD) {
    return <IconFire color="red400" />;
  }

  if (percent < CRASH_FREE_WARNING_THRESHOLD) {
    return <IconWarning color="yellow400" />;
  }

  return <IconCheckmark isCircled color="green400" />;
};

type Props = {
  percent: number;
};

const CrashFree = ({percent}: Props) => {
  return (
    <Wrapper>
      {getIcon(percent)}
      <CrahFreePercent>{displayCrashFreePercent(percent)}</CrahFreePercent>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(0.75)};
  align-items: center;
`;

const CrahFreePercent = styled('div')`
  ${overflowEllipsis};
`;

export default CrashFree;
