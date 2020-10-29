import ReactDOM from 'react-dom';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Theme} from 'app/utils/theme';
import space from 'app/styles/space';
import {IconClose} from 'app/icons';
import {slideInLeft} from 'app/styles/animations';

import {CommonSidebarProps} from './types';

type Props = React.HTMLProps<HTMLDivElement> &
  Pick<CommonSidebarProps, 'collapsed' | 'orientation' | 'hidePanel'> & {
    title?: string;
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

const getPositionForOrientation = (
  p: Pick<CommonSidebarProps, 'orientation' | 'collapsed'> & {theme: Theme}
) =>
  p.orientation === 'top'
    ? css`
        top: ${p.theme.sidebar.mobileHeight};
        left: 0;
        right: 0;
      `
    : css`
        width: 320px;
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
  background: ${p => p.theme.gray100};
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
  background: ${p => p.theme.white};
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
  color: ${p => p.theme.gray600};
  cursor: pointer;
  position: relative;
  padding: ${space(0.75)};

  &:hover {
    color: ${p => p.theme.gray800};
  }
`;

PanelClose.defaultProps = {
  size: 'lg',
};

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;
