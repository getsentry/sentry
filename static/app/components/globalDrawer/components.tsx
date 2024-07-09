import {forwardRef, Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import SlideOverPanel, {type SlideOverPanelProps} from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface DrawerPanelProps {
  children: React.ReactNode;
  headerContent: React.ReactNode;
  onClose: DrawerOptions['onClose'];
  ariaLabel?: SlideOverPanelProps['ariaLabel'];
}

export const DrawerPanel = forwardRef(function _DrawerPanel(
  {ariaLabel, children, headerContent, onClose}: DrawerPanelProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <DrawerContainer>
      <SlideOverPanel
        ariaLabel={ariaLabel}
        slidePosition="right"
        collapsed={false}
        ref={ref}
      >
        <DrawerHeader>
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
          {headerContent && (
            <Fragment>
              <HeaderBar />
              {headerContent}
            </Fragment>
          )}
        </DrawerHeader>
        {children}
      </SlideOverPanel>
    </DrawerContainer>
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

const DrawerHeader = styled('header')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.drawer + 1};
  background: ${p => p.theme.background};
  justify-content: flex-start;
  display: flex;
  padding: ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.border};
  padding-left: 24px;
`;

export const DrawerBody = styled('section')`
  padding: ${space(2)} 24px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const DrawerContainer = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;
  display: relative;
`;

export const DrawerComponents = {
  DrawerBody,
  DrawerPanel,
};

export default DrawerComponents;
