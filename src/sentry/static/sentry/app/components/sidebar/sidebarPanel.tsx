import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Theme} from 'app/utils/theme';
import space from 'app/styles/space';
import {IconClose} from 'app/icons';
import {slideInLeft} from 'app/styles/animations';

type Props = React.HTMLProps<HTMLDivElement> & {
  title?: string;
  collapsed?: boolean;
  orientation?: 'top' | 'left';
  hidePanel?: () => void;
};

/**
 * Get the container element of the sidebar that react portals into.
 */
export const getSidebarPanelContainer = () =>
  document.getElementById('sidebar-flyout-portal');

const makePortal = () => {
  const portal = document.createElement('div');
  portal.setAttribute('id', 'sidebar-flyout-portal');
  document.body.appendChild(portal);

  return portal;
};

class SidebarPanel extends React.Component<Props> {
  static propTypes = {
    title: PropTypes.string,
    collapsed: PropTypes.bool,
    orientation: PropTypes.oneOf(['top', 'left']),
    hidePanel: PropTypes.func,
  };

  constructor(props: Props) {
    super(props);
    this.portalEl = getSidebarPanelContainer() || makePortal();
  }

  portalEl: Element;

  render() {
    const {orientation, collapsed, hidePanel, title, children, ...props} = this.props;

    const sidebar = (
      <PanelContainer collapsed={collapsed} orientation={orientation} {...props}>
        {title && (
          <SidebarPanelHeader>
            <Title>{title}</Title>
            <PanelClose onClick={hidePanel} />
          </SidebarPanelHeader>
        )}
        <SidebarPanelBody hasHeader={!!title}>{children}</SidebarPanelBody>
      </PanelContainer>
    );

    return ReactDOM.createPortal(sidebar, this.portalEl);
  }
}

export default SidebarPanel;

const getPositionForOrientation = (p: Props & {theme: Theme}) =>
  p.orientation === 'top'
    ? css`
        top: ${p.theme.sidebar.mobileHeight};
        left: 0;
        right: 0;
      `
    : css`
        width: ${p.theme.sidebar.panel.width};
        top: 0;
        left: ${p.collapsed
          ? p.theme.sidebar.collapsedWidth
          : p.theme.sidebar.expandedWidth};
      `;

const PanelContainer = styled('div')`
  position: fixed;
  bottom: 0;
  display: flex;
  flex-direction: column;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  background: ${p => p.theme.whiteDark};
  color: ${p => p.theme.sidebar.background};
  border-right: 1px solid ${p => p.theme.borderLight};
  box-shadow: 1px 0 2px rgba(0, 0, 0, 0.06);
  text-align: left;
  line-height: 24px;
  animation: 200ms ${slideInLeft};

  ${getPositionForOrientation};
`;

const SidebarPanelHeader = styled('div')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(3)};
  background: ${p => p.theme.background};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  height: 62px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 1;
`;

const SidebarPanelBody = styled('div')<{hasHeader: boolean}>`
  flex-grow: 1;
  overflow: auto;
`;

const PanelClose = styled(IconClose)`
  color: ${p => p.theme.gray3};
  cursor: pointer;
  position: relative;
  padding: ${space(0.75)};

  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

PanelClose.defaultProps = {
  size: 'lg',
};

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;
