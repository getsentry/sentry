import {Button, type ButtonProps} from '@sentry/scraps/button';

import {IconCopy} from 'sentry/icons';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

interface CopyToClipboardButtonProps extends Omit<
  Extract<ButtonProps, {'aria-label': string}>,
  'children' | 'onCopy' | 'onError'
> {
  text: string;
  children?: never;
  onCopy?: undefined | ((copiedText: string) => void);
}

export function CopyToClipboardButton({
  onCopy,
  onClick,
  text,
  icon,
  ...props
}: CopyToClipboardButtonProps) {
  const {copy} = useCopyToClipboard();

  return (
    <Button
      {...props}
      onClick={e => {
        copy(text).then(result => {
          if (result !== undefined) {
            onCopy?.(result);
          }
        });
        onClick?.(e);
      }}
      icon={icon ?? <IconCopy variant="muted" />}
    />
  );
}
