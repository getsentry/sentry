import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import SlideOverPanel from 'sentry/views/starfish/components/slideOverPanel';

type DetailProps = {
  children: React.ReactNode;
  detailKey?: string;
  onClose?: () => void;
};

type DetailState = {
  collapsed: boolean;
};

export default function Detail({children, detailKey, onClose}: DetailProps) {
  const [state, setState] = useState<DetailState>({collapsed: true});
  const escapeKeyPressed = useKeyPress('Escape');

  // Any time the key prop changes (due to user interaction), we want to open the panel
  useEffect(() => {
    if (detailKey) {
      setState({collapsed: false});
    }
  }, [detailKey]);

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
      }
      setState({collapsed: true});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escapeKeyPressed]);

  return (
    <SlideOverPanel collapsed={state.collapsed} ref={panelRef}>
      <CloseButtonWrapper>
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
`;

const CloseButtonWrapper = styled('div')`
  justify-content: flex-end;
  display: flex;
  padding: ${space(2)};
`;

const DetailWrapper = styled('div')`
  padding: 0 ${space(4)};
`;
