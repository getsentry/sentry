import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import SlideOverPanel from 'sentry/views/insights/common/components/slideOverPanel';

export interface DrawerPanelProps extends Required<Omit<DrawerOptions, 'onOpen'>> {
  children: React.ReactNode;
  isOpen?: boolean;
  onOpen?: () => void;
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
  const panelRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(panelRef, () => {
    if (isOpen && closeOnOutsideClick) {
      onClose?.();
      setIsDrawerOpen(false);
    }
  });

  const handleEscapePress = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && closeOnEscapeKeypress) {
        onClose?.();
        setIsDrawerOpen(false);
      }
    },
    [isOpen, closeOnEscapeKeypress, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscapePress);
    return () => document.removeEventListener('keydown', handleEscapePress);
  }, [handleEscapePress]);

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
