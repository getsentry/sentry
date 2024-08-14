import {createContext, forwardRef, Fragment, useContext} from 'react';
import styled from '@emotion/styled';
import type {AnimationProps} from 'framer-motion';

import {Button} from 'sentry/components/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';

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
      <SlideOverPanel
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
      </SlideOverPanel>
    </DrawerContainer>
  );
});

interface DrawerHeaderProps {
  children?: React.ReactNode;
  /**
   * If true, hides the spacer bar separating close button from custom header content
   */
  hideBar?: boolean;
  /**
   * If true, hides the close button
   */
  hideCloseButton?: boolean;
}

export const DrawerHeader = forwardRef(function _DrawerHeader(
  {children = null, hideBar = false, hideCloseButton = false}: DrawerHeaderProps,
  ref: React.ForwardedRef<HTMLHeadingElement>
) {
  const {onClose} = useDrawerContentContext();

  return (
    <Header ref={ref}>
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
  margin: 0 ${p => p.theme.space(2)};
  border-right: 1px solid ${p => p.theme.border};
`;

const Header = styled('header')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.drawer + 1};
  background: ${p => p.theme.background};
  justify-content: flex-start;
  display: flex;
  padding: ${p => p.theme.space(1.5)};
  border-bottom: 1px solid ${p => p.theme.border};
  padding-left: 24px;
`;

export const DrawerBody = styled('aside')`
  padding: ${p => p.theme.space(2)} 24px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const DrawerContainer = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;
`;

export const DrawerComponents = {
  DrawerBody,
  DrawerHeader,
  DrawerPanel,
};

export default DrawerComponents;
