import styled from 'react-emotion';

const AssistantContainer = styled('div')`
  position: fixed;
  z-index: ${p => p.theme.zIndex.modal};
  bottom: 1.5rem;
  right: 1.5rem;
  height: 2.75em;
  background: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 1.45em;
  color: ${p => p.theme.purple};
  font-weight: bold;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  font-size: 1.33rem;
}
`;

export default AssistantContainer;
