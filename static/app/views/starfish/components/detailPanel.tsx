import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconPanel} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import localStorage from 'sentry/utils/localStorage';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import SlideOverPanel from 'sentry/views/starfish/components/slideOverPanel';

type DetailProps = {
  children: React.ReactNode;
  detailKey?: string;
  onClose?: () => void;
  onOpen?: () => void;
  skipCloseOnOutsideClick?: boolean;
  startingPositionOnLoad?: 'right' | 'bottom';
};

type DetailState = {
  collapsed: boolean;
};

const SLIDEOUT_STORAGE_KEY = 'starfish-panel-slideout-direction';

function isValidSlidePosition(value: string | null): value is 'right' | 'bottom' {
  return value === 'right' || value === 'bottom';
}

export default function Detail({
  children,
  detailKey,
  onClose,
  onOpen,
  startingPositionOnLoad,
  skipCloseOnOutsideClick = false,
}: DetailProps) {
  const localStorageValue = localStorage.getItem(SLIDEOUT_STORAGE_KEY);
  const storedSlideOutPosition = isValidSlidePosition(localStorageValue)
    ? localStorageValue
    : null;

  const [state, setState] = useState<DetailState>({collapsed: true});
  const [slidePosition, setSlidePosition] = useState<'right' | 'bottom'>(
    startingPositionOnLoad ?? storedSlideOutPosition ?? 'right'
  );
  const escapeKeyPressed = useKeyPress('Escape');

  // Any time the key prop changes (due to user interaction), we want to open the panel
  useEffect(() => {
    if (detailKey) {
      setState({collapsed: false});
    } else {
      setState({collapsed: true});
    }
  }, [detailKey]);

  const panelRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(panelRef, () => {
    if (!state.collapsed && !skipCloseOnOutsideClick) {
      onClose?.();
      setState({collapsed: true});
    }
  });

  useEffect(() => {
    if (escapeKeyPressed) {
      if (!state.collapsed) {
        onClose?.();
        setState({collapsed: true});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escapeKeyPressed]);

  const handleDocking = (position: 'right' | 'bottom') => {
    setSlidePosition(position);
    localStorage.setItem(SLIDEOUT_STORAGE_KEY, position);
  };

  return (
    <SlideOverPanel
      slidePosition={slidePosition}
      collapsed={state.collapsed}
      ref={panelRef}
      onOpen={onOpen}
    >
      <CloseButtonWrapper>
        <PanelButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Dock to the bottom')}
          disabled={slidePosition === 'bottom'}
          icon={<IconPanel size="sm" direction="down" />}
          onClick={() => handleDocking('bottom')}
        />
        <PanelButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Dock to the right')}
          disabled={slidePosition === 'right'}
          icon={<IconPanel size="sm" direction="right" />}
          onClick={() => handleDocking('right')}
        />
        <CloseButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Close Details')}
          icon={<IconClose size="sm" />}
          onClick={() => {
            setState({collapsed: true});
            onClose?.();
          }}
        />
      </CloseButtonWrapper>
      <DetailWrapper>{children}</DetailWrapper>
    </SlideOverPanel>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => p.theme.gray400};
  }
  z-index: 100;
`;

const PanelButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => p.theme.gray400};
  }
  z-index: 100;
`;

const CloseButtonWrapper = styled('div')`
  justify-content: flex-end;
  display: flex;
  padding: ${space(2)};
`;

const DetailWrapper = styled('div')`
  padding: 0 ${space(4)};
`;
