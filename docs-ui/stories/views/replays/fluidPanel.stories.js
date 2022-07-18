import styled from '@emotion/styled';

import {Panel as BasePanel, PanelFooter, PanelHeader} from 'sentry/components/panels';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

export default {
  title: 'Views/Replays/Fluid Panel',
};

const ManualResize = styled('div')`
  resize: both;
  overflow: auto;
  border: 1px solid ${p => p.theme.gray100};
`;

export const Basic = () => {
  return (
    <FluidPanel title={<h1>Hello World</h1>} bottom={<p>And that's all folks</p>}>
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

const Panel = styled(BasePanel)`
  overflow: hidden;
  margin-bottom: 0;
`;

export const PanelStyle = () => {
  return (
    <ManualResize>
      <Panel>
        <FluidPanel
          title={<PanelHeader>Hello World</PanelHeader>}
          bottom={<PanelFooter>And that's all folks</PanelFooter>}
        >
          <ol>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <p key={i}>
                I would walk {i} miles, and I would walk {i} more.
              </p>
            ))}
          </ol>
        </FluidPanel>
      </Panel>
    </ManualResize>
  );
};

export const Resizeable = () => {
  return (
    <ManualResize>
      <FluidPanel title={<h1>Hello World</h1>} bottom={<p>And that's all folks</p>}>
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
