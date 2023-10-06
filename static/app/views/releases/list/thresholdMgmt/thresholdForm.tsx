import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import SlideOverPanel from 'sentry/views/starfish/components/slideOverPanel';

type Props = {
  children: React.ReactNode;
  formData?: {[key: string]: any};
  onClose?: () => void;
  onOpen?: () => void;
};

export default function ThresholdForm({children, formData, onClose, onOpen}: Props) {
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const escapeKeyPressed = useKeyPress('Escape');

  // Any time the key prop changes (due to user interaction), we want to open the panel
  useEffect(() => {
    if (formData) {
      setFormOpen(true);
    } else {
      setFormOpen(false);
    }
  }, [formData]);

  const panelRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(panelRef, () => {
    if (formOpen) {
      onClose?.();
      setFormOpen(false);
    }
  });

  useEffect(() => {
    if (escapeKeyPressed) {
      if (formOpen) {
        onClose?.();
        setFormOpen(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escapeKeyPressed]);

  return (
    <SlideOverPanel collapsed={!formOpen} ref={panelRef} onOpen={onOpen}>
      <CloseButtonWrapper>
        <CloseButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Close Form')}
          icon={<IconClose size="sm" />}
          onClick={() => {
            setFormOpen(false);
            onClose?.();
          }}
        />
      </CloseButtonWrapper>
      <FormWrapper>{children}</FormWrapper>
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

const FormWrapper = styled('div')`
  padding: 0 ${space(4)};
`;
