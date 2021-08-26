import styled from '@emotion/styled';

import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import {IconSize} from 'app/utils/theme';

import {displayCrashFreePercent, releaseDisplayLabel} from '../utils';

import {DisplayOption} from './utils';

const CRASH_FREE_DANGER_THRESHOLD = 98;
const CRASH_FREE_WARNING_THRESHOLD = 99.5;

const getIcon = (percent: number, iconSize: IconSize) => {
  if (percent < CRASH_FREE_DANGER_THRESHOLD) {
    return <IconFire color="red300" size={iconSize} />;
  }

  if (percent < CRASH_FREE_WARNING_THRESHOLD) {
    return <IconWarning color="yellow300" size={iconSize} />;
  }

  return <IconCheckmark isCircled color="green300" size={iconSize} />;
};

type Props = {
  percent: number;
  iconSize?: IconSize;
  /**
   * If provided there will be a label next to percentage
   */
  displayOption?: DisplayOption;
};

const CrashFree = ({percent, iconSize = 'sm', displayOption}: Props) => {
  return (
    <Wrapper>
      {getIcon(percent, iconSize)}
      <CrashFreePercent>
        {displayCrashFreePercent(percent)}{' '}
        {defined(displayOption) && releaseDisplayLabel(displayOption, 2)}
      </CrashFreePercent>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(1)};
  align-items: center;
  vertical-align: middle;
`;

const CrashFreePercent = styled('div')`
  ${overflowEllipsis};
`;

export default CrashFree;
