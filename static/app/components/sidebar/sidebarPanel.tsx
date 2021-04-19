import React from 'react';
import ReactDOM from 'react-dom';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {IconClose} from 'app/icons';
import {slideInLeft} from 'app/styles/animations';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

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

  componentDidMount() {
    document.addEventListener('click', this.panelCloseHandler);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.panelCloseHandler);
  }

  portalEl: Element;

  panelCloseHandler = (evt: MouseEvent) => {
    if (!(evt.target instanceof Element)) {
      return;
    }

    const panel = getSidebarPanelContainer();

    if (panel?.contains(evt.target)) {
      return;
    }

    this.props.hidePanel();
  };

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
        width: 360px;
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
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  border-right: 1px solid ${p => p.theme.border};
  box-shadow: 1px 0 2px rgba(0, 0, 0, 0.06);
  text-align: left;
  animation: 200ms ${slideInLeft};

  ${getPositionForOrientation};
`;

const SidebarPanelHeader = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(3)};
  background: ${p => p.theme.background};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 1;
`;

const SidebarPanelBody = styled('div')<{hasHeader: boolean}>`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: auto;
  position: relative;
`;

const PanelClose = styled(IconClose)`
  color: ${p => p.theme.subText};
  cursor: pointer;
  position: relative;
  padding: ${space(0.75)};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

PanelClose.defaultProps = {
  size: 'lg',
};

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;
