import styled from '@emotion/styled';

import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';

import {Basic as FliudPanelDemo} from './fluidPanel.stories';

export default {
  title: 'Views/Replays/Split Panel',
};

const ManualResize = styled('div')`
  resize: both;
  overflow: auto;
  border: 1px solid ${p => p.theme.gray100};
`;

function List() {
  return (
    <ol>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <p key={i}>
          I would walk {i} miles, and I would walk {i} more.
        </p>
      ))}
    </ol>
  );
}

export const LeftRightSplit = () => {
  return (
    <ManualResize>
      <SplitPanel left={<List />} right={<List />} />
    </ManualResize>
  );
};

export const TopBottomSplit = () => {
  return (
    <ManualResize>
      <SplitPanel top={<List />} bottom={<List />} />
    </ManualResize>
  );
};

export const LeftRightFluidContents = props => {
  return (
    <ManualResize>
      <SplitPanel left={<FliudPanelDemo />} right={<FliudPanelDemo panel />} {...props} />
    </ManualResize>
  );
};

LeftRightFluidContents.args = {
  minPx: 0,
  maxPx: Number.MAX_SAFE_INTEGER,
  minPct: 0,
  maxPct: 100,
};
export const TopBottomFluidContents = () => {
  return (
    <ManualResize>
      <SplitPanel top={<FliudPanelDemo />} bottom={<FliudPanelDemo panel />} />
    </ManualResize>
  );
};
