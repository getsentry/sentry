import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';

type Props = {
  children: ReactNode;
  bottom?: ReactNode;
  className?: string;
  panel?: boolean;
  scroll?: boolean;
  title?: ReactNode;
};

function FluidPanel({className, children, bottom, title, panel, scroll = true}: Props) {
  const wrappedContent = panel ? (
    <OverflowPanelBody scroll={scroll}>{children}</OverflowPanelBody>
  ) : (
    <OverflowBody scroll={scroll}>{children}</OverflowBody>
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
      <FluidPanelContainer className={className}>
        {wrappedHeader}
        {wrappedContent}
        {wrappedFooter}
      </FluidPanelContainer>
    );
  }
  return (
    <FluidContainer className={className}>
      {wrappedHeader}
      {wrappedContent}
      {wrappedFooter}
    </FluidContainer>
  );
}

const FluidContainer = styled('section')`
  display: grid;
  grid-template-rows: auto 1fr auto;
  max-height: 100%;
`;

const FluidPanelContainer = styled(Panel)`
  display: grid;
  grid-template-rows: auto 1fr auto;
  max-height: 100%;
`;

const OverflowBody = styled('div')<{scroll: boolean}>`
  max-height: 100%;
  overflow: ${p => (p.scroll ? 'auto;' : 'hidden')};
`;

const OverflowPanelBody = styled(PanelBody)<{scroll: boolean}>`
  overflow: ${p => (p.scroll ? 'auto;' : 'hidden')};
`;

export default FluidPanel;
