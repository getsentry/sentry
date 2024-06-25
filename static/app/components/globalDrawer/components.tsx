import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import SlideOverPanel from 'sentry/views/insights/common/components/slideOverPanel';

export interface DrawerPanelProps extends DrawerOptions {
  children: React.ReactNode;
  isOpen?: boolean;
}

export function DrawerPanel({
  children,
  isOpen = false,
  onClose,
  onOpen,
  closeOnOutsideClick = true,
  closeOnEscapeKeypress = true,
}: DrawerPanelProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(isOpen);
  const escapeKeyPressed = useKeyPress('Escape');
  const panelRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(panelRef, () => {
    if (isOpen && closeOnOutsideClick) {
      onClose?.();
      setIsDrawerOpen(false);
    }
  });

  useEffect(() => {
    if (isOpen && escapeKeyPressed && closeOnEscapeKeypress) {
      onClose?.();
      setIsDrawerOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escapeKeyPressed, closeOnEscapeKeypress]);

  useEffect(() => {
    setIsDrawerOpen(isOpen);
  }, [isOpen]);

  return (
    <div role="complementary" aria-hidden={!isDrawerOpen}>
      <SlideOverPanel
        slidePosition="right"
        collapsed={!isDrawerOpen}
        ref={panelRef}
        onOpen={onOpen}
      >
        <DrawerHeader>
          <CloseButton
            priority="link"
            size="zero"
            borderless
            aria-label={t('Close Drawer')}
            icon={<IconClose size="sm" />}
            onClick={() => {
              setIsDrawerOpen(false);
              onClose?.();
            }}
          >
            {t('Close')}
          </CloseButton>
        </DrawerHeader>
        {children}
      </SlideOverPanel>
    </div>
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
