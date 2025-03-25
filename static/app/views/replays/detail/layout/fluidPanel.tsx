import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
  bodyRef?: React.RefObject<HTMLDivElement | null>;
  bottom?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
};

function FluidPanel({className, children, bottom, title, bodyRef}: Props) {
  return (
    <FluidContainer className={className}>
      {title}
      <OverflowBody
        // @ts-expect-error TODO(react19): Remove ts-expect-error once we upgrade to React 19
        ref={bodyRef}
      >
        {children}
      </OverflowBody>
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
