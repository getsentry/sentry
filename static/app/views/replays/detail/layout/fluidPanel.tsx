import {LegacyRef, ReactChild} from 'react';
import styled from '@emotion/styled';

type Props = {
  children: ReactChild;
  bodyRef?: LegacyRef<HTMLDivElement> | undefined;
  bottom?: ReactChild;
  className?: string;
  title?: ReactChild;
};

function FluidPanel({className, children, bottom, title, bodyRef}: Props) {
  return (
    <FluidContainer className={className}>
      {title}
      <OverflowBody ref={bodyRef}>{children}</OverflowBody>
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
