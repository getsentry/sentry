import styled from '@emotion/styled';

import space from 'app/styles/space';
import {FrameBadge} from 'app/types';

import GroupingBadge from './groupingBadge';

type Props = {
  isPrefix?: boolean;
  isSentinel?: boolean;
  isUsedForGrouping?: boolean;
  inApp?: boolean;
};

function GroupingBadges({isPrefix, isSentinel, isUsedForGrouping, inApp}: Props) {
  const badges: React.ReactElement[] = [];

  if (isSentinel) {
    badges.push(<GroupingBadge badge={FrameBadge.SENTINEL} />);
  }

  if (isPrefix) {
    badges.push(<GroupingBadge badge={FrameBadge.PREFIX} />);
  }

  if (isUsedForGrouping) {
    badges.push(<GroupingBadge badge={FrameBadge.GROUPING} />);
  }

  if (inApp) {
    badges.push(<GroupingBadge badge={FrameBadge.IN_APP} />);
  }

  if (badges.length === 0) {
    return null;
  }

  return <Wrapper>{badges}</Wrapper>;
}

export default GroupingBadges;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  justify-content: flex-end;
  align-items: flex-start;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-auto-flow: column;
  }
`;
