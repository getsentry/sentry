import {useCallback, useId} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from '@sentry/scraps/input';
import type {InputProps} from '@sentry/scraps/input';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {t} from 'sentry/locale';
import {selectText} from 'sentry/utils/selectText';

interface Props extends Omit<InputProps, 'onCopy'> {
  /**
   * Text to copy
   */
  children: string;
  className?: string;
  disabled?: boolean;
  /**
   * Icon displayed before the copied text.
   */
  icon?: React.ReactNode;
  onCopy?: (value: string) => void;
  style?: React.CSSProperties;
}

export function TextCopyInput({
  className,
  disabled,
  icon,
  style,
  onCopy,
  size,
  children,
  ...inputProps
}: Props) {
  const textNodeId = useId();

  const handleSelectText = useCallback(() => {
    const node = document.getElementById(textNodeId) as HTMLInputElement | null;
    if (!node) {
      return;
    }

    selectText(node);
  }, [textNodeId]);

  return (
    <InputGroup className={className}>
      {icon && (
        <InputGroup.LeadingItems disablePointerEvents>{icon}</InputGroup.LeadingItems>
      )}
      <StyledInput
        id={textNodeId}
        readOnly
        disabled={disabled}
        style={style}
        value={children}
        onClick={handleSelectText}
        size={size}
        {...inputProps}
      />
      <InputGroup.TrailingItems>
        <StyledCopyButton
          aria-label={t('Copy to clipboard')}
          variant="transparent"
          size={size === 'xs' ? 'xs' : 'sm'}
          onCopy={onCopy}
          text={children}
        />
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

const StyledInput = styled(InputGroup.Input)`
  direction: ltr;
`;

const StyledCopyButton = styled(CopyToClipboardButton)`
  padding: ${p => p.theme.space.xs};
  min-height: 0;
  height: auto;
`;
