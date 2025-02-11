import {useCallback, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MOBILE_HEIGHT,
} from 'sentry/components/sidebar/constants';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {slideInLeft} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';

import type {CommonSidebarProps} from './types';

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
          top: ${SIDEBAR_MOBILE_HEIGHT};
          left: 0;
          right: 0;
        `
      : css`
          width: 460px;
          top: 0;
          left: ${p.collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH};
        `};
`;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: CommonSidebarProps['collapsed'];
  hidePanel: CommonSidebarProps['hidePanel'];
  orientation: CommonSidebarProps['orientation'];
  title?: string;
}

const getSidebarPortal = () => {
  let portal = document.getElementById('sidebar-flyout-portal');

  if (!portal) {
    portal = document.createElement('div');
    portal.setAttribute('id', 'sidebar-flyout-portal');
    document.body.appendChild(portal);
  }

  return portal as HTMLDivElement;
};

export default function SidebarPanel({
  orientation,
  collapsed,
  hidePanel,
  title,
  children,
  ...props
}: Props): React.ReactElement {
  const portalEl = useRef<HTMLDivElement>(getSidebarPortal());

  const panelCloseHandler = useCallback(
    (evt: MouseEvent) => {
      if (!(evt.target instanceof Element)) {
        return;
      }

      if (portalEl.current.contains(evt.target)) {
        return;
      }

      // If we are in Sandbox, don't hide panel when the modal is clicked (before the email is added)
      const blockHideSidebar = HookStore.get('onboarding:block-hide-sidebar')[0]?.();
      if (blockHideSidebar) {
        return;
      }
      hidePanel();
    },
    [hidePanel]
  );

  useEffect(() => {
    // Wait one tick to setup the click handler so we don't detect the click
    // that is bubbling up from opening the panel itself
    window.setTimeout(() => document.addEventListener('click', panelCloseHandler));

    return function cleanup() {
      window.setTimeout(() => document.removeEventListener('click', panelCloseHandler));
    };
  }, [panelCloseHandler]);

  return createPortal(
    <PanelContainer
      role="dialog"
      collapsed={collapsed}
      orientation={orientation}
      {...props}
    >
      {title ? (
        <SidebarPanelHeader>
          <Title>{title}</Title>
          <PanelClose size="lg" onClick={hidePanel} aria-label={t('Close Panel')} />
        </SidebarPanelHeader>
      ) : null}
      <SidebarPanelBody hasHeader={!!title}>{children}</SidebarPanelBody>
    </PanelContainer>,
    portalEl.current
  );
}

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

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;
