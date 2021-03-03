import styled from '@emotion/styled';

const SidebarPanelEmpty = styled('div')`
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray300};
  padding: 0 60px;
  text-align: center;
`;

export default SidebarPanelEmpty;
