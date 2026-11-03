import type * as React from 'react';
import {IconCopy} from '@sentry/icons/copy';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {toast} from '@sentry/scraps/toast';
import {useTranslation} from '@sentry/scraps/translation';

export interface CopyToClipboardButtonProps extends Omit<
  Extract<ButtonProps, {'aria-label': string}>,
  'children' | 'onCopy' | 'onError'
> {
  text: string;
  children?: never;
  /** Custom failure feedback. Pass false to suppress the toast. */
  errorMessage?: React.ReactNode;
  onCopy?: (copiedText: string) => void;
  onError?: (error: unknown) => void;
  /** Custom success feedback. Pass false to suppress the toast. */
  successMessage?: React.ReactNode;
}

export function CopyToClipboardButton({
  onCopy,
  onError,
  onClick,
  text,
  icon,
  errorMessage,
  successMessage,
  ...props
}: CopyToClipboardButtonProps) {
  const {t} = useTranslation();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const message = errorMessage ?? t('Error copying to clipboard');
      if (message) {
        toast.error(message);
      }
      onError?.(error);
      return;
    }
    const message = successMessage ?? t('Copied to clipboard');
    if (message) {
      toast.success(message);
    }
    onCopy?.(text);
  }

  return (
    <Button
      {...props}
      onClick={event => {
        void copy();
        onClick?.(event);
      }}
      icon={icon ?? <IconCopy variant="muted" />}
    />
  );
}
