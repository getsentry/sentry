import styled from 'react-emotion';

const AssistantContainer = styled('div')`
  position: fixed;
  z-index: ${p => p.theme.zIndex.modal};
  width: 25vw;
  max-width: 450px;
  min-width: 300px;
  bottom: 1vw;
  right: 1vw;
  background: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 1.45em;
  color: ${p => p.theme.purple};
  font-weight: bold;
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

export default AssistantContainer;
