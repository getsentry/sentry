import styled from '@emotion/styled';

import space from 'app/styles/space';
import {FrameBadge} from 'app/types';

import GroupingBadge from './groupingBadge';

type Props = {
  isPrefix?: boolean;
  isSentinel?: boolean;
  isUsedForGrouping?: boolean;
};

function GroupingBadges({isPrefix, isSentinel, isUsedForGrouping}: Props) {
  const badges: React.ReactElement[] = [];

  if (isSentinel) {
    badges.push(<GroupingBadge key={FrameBadge.SENTINEL} badge={FrameBadge.SENTINEL} />);
  }

  if (isPrefix) {
    badges.push(<GroupingBadge key={FrameBadge.PREFIX} badge={FrameBadge.PREFIX} />);
  }

  if (isUsedForGrouping) {
    badges.push(<GroupingBadge key={FrameBadge.GROUPING} badge={FrameBadge.GROUPING} />);
  }

  return <Wrapper hasGroupingBadges={!!badges.length}>{badges}</Wrapper>;
}

export default GroupingBadges;

const Wrapper = styled('div')<{hasGroupingBadges: boolean}>`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(0.5)};
  align-items: flex-start;
  justify-content: flex-start;
  order: 2;
  grid-column-start: 1;
  grid-column-end: -1;
  margin-top: ${p => (p.hasGroupingBadges ? space(1) : 0)};

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    margin-top: 0;
    justify-content: flex-end;
    order: 0;
    grid-column-start: auto;
    grid-column-end: auto;
  }
`;
