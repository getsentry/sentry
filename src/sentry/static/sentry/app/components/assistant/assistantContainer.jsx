import styled from 'react-emotion';

const AssistantContainer = styled('div')`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  height: 2.75em;
  background: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 20px;
  border-radius: 3em;
  color: ${p => p.theme.purple};
  font-weight: bold;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  font-size: 1.33rem;
  align-items: center;
}
`;

export default AssistantContainer;
