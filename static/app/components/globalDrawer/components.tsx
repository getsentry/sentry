import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer/types';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export interface DrawerPanelProps extends Required<Omit<DrawerOptions, 'onOpen'>> {
  children: React.ReactNode;
  onOpen?: () => void;
}

export function DrawerPanel({children, onClose, onOpen}: DrawerPanelProps) {
  return (
    <DrawerContainer>
      <SlideOverPanel slidePosition="right" collapsed={false} onOpen={onOpen}>
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
        </DrawerHeader>
        {children}
      </SlideOverPanel>
    </DrawerContainer>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export const DrawerHeader = styled('header')`
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

export const DrawerContainer = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;
`;
