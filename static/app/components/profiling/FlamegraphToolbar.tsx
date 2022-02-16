import styled from '@emotion/styled';

<<<<<<< HEAD
interface FlamegraphToolbarProps {
  children: React.ReactNode;
}

export const FlamegraphToolbar = styled('div')<FlamegraphToolbarProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;

  > div {
    flex: 1;
  }
=======
function FlamegraphToolbar(props): React.ReactElement {
  return <FlamegraphToolbarContainer>{props.children}</FlamegraphToolbarContainer>;
}

export {FlamegraphToolbar};

const FlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
>>>>>>> aed5bd995c (feat(flamegraphs): add thread selector)
`;
