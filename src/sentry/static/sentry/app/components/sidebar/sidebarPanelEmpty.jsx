import styled from 'react-emotion';

const SidebarPanelEmpty = styled('div')`
  color: #9586a5;
  text-align: center;
  width: 100%;
  position: absolute;
  top: 50%;
  padding: 0 60px;
  margin-top: ${() =>
    `${-62 - 16 / 2}px;`}; // offset for sidebar-panel-header + font-size
`;

export default SidebarPanelEmpty;
