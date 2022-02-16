import styled from '@emotion/styled';

function FlamegraphToolbar(props): React.ReactElement {
  return <FlamegraphToolbarContainer>{props.children}</FlamegraphToolbarContainer>;
}

export {FlamegraphToolbar};

const FlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
