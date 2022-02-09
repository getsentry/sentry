import {useEffect, useRef} from 'react';
import ReactDOM from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {IconClose} from 'sentry/icons';
import {slideInLeft} from 'sentry/styles/animations';
import space from 'sentry/styles/space';

import {CommonSidebarProps} from './types';

type PositionProps = Pick<CommonSidebarProps, 'orientation' | 'collapsed'>;

const PanelContainer = styled('div')<PositionProps>`
  position: fixed;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  border-right: 1px solid ${p => p.theme.border};
  box-shadow: 1px 0 2px rgba(0, 0, 0, 0.06);
  text-align: left;
  animation: 200ms ${slideInLeft};
  z-index: ${p => p.theme.zIndex.sidebar - 1};

  ${p =>
    p.orientation === 'top'
      ? css`
          top: ${p.theme.sidebar.mobileHeight};
          left: 0;
          right: 0;
        `
      : css`
          width: 460px;
          top: 0;
          left: ${p.collapsed
            ? p.theme.sidebar.collapsedWidth
            : p.theme.sidebar.expandedWidth};
        `};
`;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: CommonSidebarProps['collapsed'];
  hidePanel: CommonSidebarProps['hidePanel'];
  orientation: CommonSidebarProps['orientation'];
  title?: string;
}

/**
 * Get the container element of the sidebar that react portals into.
 */
export const getSidebarPanelContainer = () =>
  document.getElementById('sidebar-flyout-portal') as HTMLDivElement;

const makePortal = () => {
  const portal = document.createElement('div');
  portal.setAttribute('id', 'sidebar-flyout-portal');
  document.body.appendChild(portal);

  return portal;
};

function SidebarPanel({
  orientation,
  collapsed,
  hidePanel,
  title,
  children,
  ...props
}: Props): React.ReactElement {
  const portalEl = useRef<HTMLDivElement>(getSidebarPanelContainer() || makePortal());

  function panelCloseHandler(evt: MouseEvent) {
    if (!(evt.target instanceof Element)) {
      return;
    }

    const panel = getSidebarPanelContainer();

    if (panel?.contains(evt.target)) {
      return;
    }

    hidePanel();
  }

  useEffect(() => {
    document.addEventListener('click', panelCloseHandler);
    return function cleanup() {
      document.removeEventListener('click', panelCloseHandler);
    };
  }, []);

  return ReactDOM.createPortal(
    <PanelContainer
      role="dialog"
      collapsed={collapsed}
      orientation={orientation}
      {...props}
    >
      {title ? (
        <SidebarPanelHeader>
          <Title>{title}</Title>
          <PanelClose onClick={hidePanel} />
        </SidebarPanelHeader>
      ) : null}
      <SidebarPanelBody hasHeader={!!title}>{children}</SidebarPanelBody>
    </PanelContainer>,
    portalEl.current
  );
}

export default SidebarPanel;

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
