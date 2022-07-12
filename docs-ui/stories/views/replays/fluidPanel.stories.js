import styled from '@emotion/styled';

import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

export default {
  title: 'Views/Replays/Fluid Panel',
};

const ManualResize = styled('div')`
  resize: both;
  overflow: auto;
  border: 1px solid ${p => p.theme.gray100};
`;

export const Basic = ({panel}) => {
  return (
    <FluidPanel
      title={<h1>Hello World</h1>}
      bottom={<p>And that's all folks</p>}
      panel={panel}
    >
      <ol>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <p key={i}>
            I would walk {i} miles, and I would walk {i} more.
          </p>
        ))}
      </ol>
    </FluidPanel>
  );
};

Basic.args = {
  panel: false,
};

export const Resizeable = ({panel}) => {
  return (
    <ManualResize>
      <FluidPanel
        title={<h1>Hello World</h1>}
        bottom={<p>And that's all folks</p>}
        panel={panel}
      >
        <ol>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <p key={i}>
              I would walk {i} miles, and I would walk {i} more.
            </p>
          ))}
        </ol>
      </FluidPanel>
    </ManualResize>
  );
};

Basic.args = {
  panel: false,
};
