import {IconCopy} from '@sentry/icons/copy';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {useClipboardFeedback} from './clipboardFeedbackContext';

export interface CopyToClipboardButtonProps extends Omit<
  Extract<ButtonProps, {'aria-label': string}>,
  'children' | 'onCopy' | 'onError'
> {
  text: string;
  children?: never;
  onCopy?: (copiedText: string) => void;
  onError?: (error: unknown) => void;
}

export function CopyToClipboardButton({
  onCopy,
  onError,
  onClick,
  text,
  icon,
  ...props
}: CopyToClipboardButtonProps) {
  const feedback = useClipboardFeedback();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      feedback.onError?.(error);
      onError?.(error);
      return;
    }
    feedback.onCopy?.(text);
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
