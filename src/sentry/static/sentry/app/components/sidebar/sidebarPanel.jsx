import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

class SidebarPanel extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    collapsed: PropTypes.bool,
    orientation: PropTypes.oneOf(['top', 'left']),
    hidePanel: PropTypes.func,
  };

  render() {
    let {orientation, collapsed, hidePanel, title, children, ...props} = this.props;
    return (
      <StyledSidebarPanel collapsed={collapsed} orientation={orientation} {...props}>
        <SidebarPanelHeader>
          <PanelClose onClick={hidePanel}>
            <span className="icon-close" />
          </PanelClose>
          <Title>{title}</Title>
        </SidebarPanelHeader>

        <SidebarPanelBody>{children}</SidebarPanelBody>
      </StyledSidebarPanel>
    );
  }
}

export default SidebarPanel;

const getPositionForOrientation = p => {
  if (p.orientation === 'top') {
    return css`
      top: ${p.theme.sidebar.mobileHeight};
      left: 0;
      right: 0;
    `;
  }

  return css`
    width: ${p.theme.sidebar.panel.width};
    top: 0;
    left: ${p.collapsed ? p.theme.sidebar.collapsedWidth : p.theme.sidebar.expandedWidth};
  `;
};
const StyledSidebarPanel = styled(({collapsed, orientation, ...props}) => (
  <div {...props} />
))`
  position: fixed;
  bottom: 0;
  background: ${p => p.theme.whiteDark};
  z-index: ${p => p.theme.zIndex.sidebar};
  color: #2f2936;
  border-right: 1px solid ${p => p.theme.borderLight};
  box-shadow: 1px 0 2px rgba(0, 0, 0, 0.06);
  text-align: left;
  line-height: 24px;

  ${getPositionForOrientation};
`;

const SidebarPanelHeader = styled('div')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: 20px;
  background: ${p => p.theme.background};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  height: ${p => p.theme.sidebar.panel.headerHeight};
`;
const SidebarPanelBody = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: ${p => p.theme.sidebar.panel.headerHeight};
  overflow: auto;
`;

const PanelClose = styled('a')`
  float: right;
  font-size: 22px;
  position: relative;
  top: 0;
  right: -3px;
  color: ${p => p.theme.gray3};

  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

const Title = styled('div')`
  font-size: 18px;
  margin: 0;
`;
