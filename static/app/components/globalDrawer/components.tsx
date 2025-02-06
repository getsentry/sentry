import {createContext, forwardRef, Fragment, useContext} from 'react';
import styled from '@emotion/styled';
import type {AnimationProps} from 'framer-motion';

import {Button} from 'sentry/components/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface DrawerContentContextType {
  ariaLabel: string;
  onClose: DrawerOptions['onClose'];
}

const DrawerContentContext = createContext<DrawerContentContextType>({
  onClose: () => {},
  ariaLabel: 'slide out drawer',
});

function useDrawerContentContext() {
  return useContext(DrawerContentContext);
}

interface DrawerPanelProps {
  ariaLabel: DrawerContentContextType['ariaLabel'];
  children: React.ReactNode;
  headerContent: React.ReactNode;
  onClose: DrawerContentContextType['onClose'];
  transitionProps?: AnimationProps['transition'];
}

export const DrawerPanel = forwardRef(function _DrawerPanel(
  {ariaLabel, children, transitionProps, onClose}: DrawerPanelProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <DrawerContainer>
      <DrawerSlidePanel
        ariaLabel={ariaLabel}
        slidePosition="right"
        collapsed={false}
        ref={ref}
        transitionProps={transitionProps}
      >
        {/*
          This provider allows data passed to openDrawer to be accessed by drawer components.
          For example: <DrawerHeader />, will trigger the custom onClose callback set in openDrawer
          when it's button is pressed.
        */}
        <DrawerContentContext.Provider value={{onClose, ariaLabel}}>
          {children}
        </DrawerContentContext.Provider>
      </DrawerSlidePanel>
    </DrawerContainer>
  );
});

interface DrawerHeaderProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * If true, hides the spacer bar separating close button from custom header content
   */
  hideBar?: boolean;
  /**
   * If true, hides the close button
   */
  hideCloseButton?: boolean;
}

export const DrawerHeader = forwardRef(function DrawerHeaderInner(
  {
    className,
    children = null,
    hideBar = false,
    hideCloseButton = false,
  }: DrawerHeaderProps,
  ref: React.ForwardedRef<HTMLHeadingElement>
) {
  const {onClose} = useDrawerContentContext();

  return (
    <Header ref={ref} className={className}>
      {!hideCloseButton && (
        <Fragment>
          <CloseButton
            priority="link"
            size="xs"
            borderless
            aria-label={t('Close Drawer')}
            icon={<IconClose />}
            onClick={onClose}
          >
            {t('Close')}
          </CloseButton>
          {!hideBar && <HeaderBar />}
        </Fragment>
      )}
      {children}
    </Header>
  );
});

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const HeaderBar = styled('div')`
  margin: 0 ${space(2)};
  border-right: 1px solid ${p => p.theme.border};
`;

const Header = styled('header')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.drawer + 1};
  background: ${p => p.theme.background};
  justify-content: flex-start;
  display: flex;
  padding: ${space(1.5)};
  box-shadow: ${p => p.theme.border} 0 1px;
  padding-left: 24px;
`;

export const DrawerBody = styled('aside')`
  padding: ${space(2)} 24px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const DrawerContainer = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;
`;

const DrawerSlidePanel = styled(SlideOverPanel)`
  box-shadow: 0 0 0 1px ${p => p.theme.translucentBorder};
`;

export const DrawerComponents = {
  DrawerBody,
  DrawerHeader,
  DrawerPanel,
};

export default DrawerComponents;
