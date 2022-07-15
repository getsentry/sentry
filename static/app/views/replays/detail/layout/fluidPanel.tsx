import {ReactChild} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';

type Props = {
  children: ReactChild;
  bottom?: ReactChild;
  className?: string;
  panel?: boolean;
  scroll?: boolean;
  title?: ReactChild;
};

function FluidPanel({className, children, bottom, title, panel, scroll = true}: Props) {
  const wrappedContent = panel ? (
    <OverflowPanelBody scroll={scroll}>{children}</OverflowPanelBody>
  ) : (
    <OverflowBody scroll={scroll}>{children}</OverflowBody>
  );

  const wrappedHeader = title ? panel ? <PanelHeader>{title}</PanelHeader> : title : null;

  const wrappedFooter = bottom ? (
    panel ? (
      <PanelFooter>{bottom}</PanelFooter>
    ) : (
      bottom
    )
  ) : null;

  if (panel) {
    return (
      <FluidPanelContainer className={className}>
        {wrappedHeader}
        {wrappedContent}
        {wrappedFooter}
      </FluidPanelContainer>
    );
  }
  return (
    <FluidContainer className={className}>
      {title}
      {wrappedContent}
      {bottom}
    </FluidContainer>
  );
}

const FluidContainer = styled('section')`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
`;

const FluidPanelContainer = styled(Panel)`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;

  margin-bottom: 0;
`;

const OverflowBody = styled('div')<{scroll: boolean}>`
  height: 100%;
  overflow: ${p => (p.scroll ? 'auto;' : 'hidden')};
`;

const OverflowPanelBody = styled(PanelBody)<{scroll: boolean}>`
  overflow: ${p => (p.scroll ? 'auto;' : 'hidden')};
`;

export default FluidPanel;
