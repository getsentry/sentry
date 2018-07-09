import styled from 'react-emotion';

const PanelItemGroup = styled('div')`
  border-left: 4px solid ${p => p.theme.borderLight};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.offWhite};
`;

export default PanelItemGroup;
