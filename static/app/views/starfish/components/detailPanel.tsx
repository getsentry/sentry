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
};

type DetailState = {
  collapsed: boolean;
};

const SLIDEOUT_STORAGE_KEY = 'starfish-panel-slideout-direction';

function getSlideOutDirection(): 'Right' | 'Bottom' {
  const localValue = localStorage.getItem(SLIDEOUT_STORAGE_KEY) || 'Right';
  if (localValue !== 'Bottom' && localValue !== 'Right') {
    return 'Right';
  }
  return localValue;
}

function setSlideOutDirection(direction: 'Right' | 'Bottom') {
  localStorage.setItem(SLIDEOUT_STORAGE_KEY, direction);
}

export default function Detail({children, detailKey, onClose, onOpen}: DetailProps) {
  const [state, setState] = useState<DetailState>({collapsed: true});
  const [slideDirection, setSlideDirection] = useState<'Right' | 'Bottom'>(
    getSlideOutDirection()
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

  useEffect(() => {
    setSlideOutDirection(slideDirection);
  }, [slideDirection]);

  const panelRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(panelRef, () => {
    if (!state.collapsed) {
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

  return (
    <SlideOverPanel
      slideDirection={slideDirection}
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
          disabled={slideDirection === 'Bottom'}
          icon={<IconPanel size="sm" direction="down" />}
          onClick={() => {
            setSlideDirection('Bottom');
          }}
        />
        <PanelButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Dock to the right')}
          disabled={slideDirection === 'Right'}
          icon={<IconPanel size="sm" direction="right" />}
          onClick={() => {
            setSlideDirection('Right');
          }}
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
