import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';

type Props = {
  children: ReactNode;
  bottom?: ReactNode;
  panel?: boolean;
  title?: ReactNode;
};

function FluidPanel({children, bottom, panel, title}: Props) {
  const wrappedContent = panel ? (
    <OverflowPanelBody>{children}</OverflowPanelBody>
  ) : (
    <OverflowBody>{children}</OverflowBody>
  );

  const wrappedHeader = title ? (
    panel ? (
      <PanelHeader>{title}</PanelHeader>
    ) : (
      <div>{title}</div>
    )
  ) : null;

  const wrappedFooter = bottom ? (
    panel ? (
      <PanelFooter>{bottom}</PanelFooter>
    ) : (
      <div>{bottom}</div>
    )
  ) : null;

  if (panel) {
    return (
      <PanelCanvas>
        {wrappedHeader}
        {wrappedContent}
        {wrappedFooter}
      </PanelCanvas>
    );
  }
  return (
    <Canvas>
      {wrappedHeader}
      {wrappedContent}
      {wrappedFooter}
    </Canvas>
  );
}

const Canvas = styled('div')`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
`;

const PanelCanvas = styled(Panel)`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
`;

const OverflowBody = styled('div')`
  overflow: auto;
`;

const OverflowPanelBody = styled(PanelBody)`
  overflow: auto;
`;

export default FluidPanel;
