import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
  title?: React.ReactNode;
};

export function FluidPanel({children, title}: Props) {
  return (
    <FluidContainer>
      {title}
      <OverflowBody>{children}</OverflowBody>
    </FluidContainer>
  );
}

const FluidContainer = styled('section')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const OverflowBody = styled('div')`
  flex: 1 1 auto;
  overflow: auto;
`;
