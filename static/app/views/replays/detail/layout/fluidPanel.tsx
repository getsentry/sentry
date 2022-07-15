import {ReactChild} from 'react';
import styled from '@emotion/styled';

type Props = {
  children: ReactChild;
  bottom?: ReactChild;
  className?: string;
  title?: ReactChild;
};

function FluidPanel({className, children, bottom, title}: Props) {
  return (
    <FluidContainer className={className}>
      {title}
      <OverflowBody>{children}</OverflowBody>
      {bottom}
    </FluidContainer>
  );
}

const FluidContainer = styled('section')`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
`;

const OverflowBody = styled('div')`
  height: 100%;
  overflow: auto;
`;

export default FluidPanel;
