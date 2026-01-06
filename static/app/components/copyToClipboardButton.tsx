import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconCopy} from 'sentry/icons';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface CopyToClipboardButtonProps
  extends Omit<
    Extract<ButtonProps, {'aria-label': string}>,
    'children' | 'onCopy' | 'onError'
  > {
  text: string;
  children?: never;
  onCopy?: undefined | ((copiedText: string) => void);
  onError?: undefined | ((error: Error) => void);
}

export function CopyToClipboardButton({
  onCopy,
  onError,
  text,
  ...props
}: CopyToClipboardButtonProps) {
  const {copy} = useCopyToClipboard();

  return (
    <Button
      translucentBorder
      onClick={e => {
        copy(text).then(onCopy).catch(onError);
        props.onClick?.(e);
      }}
      icon={<IconCopy variant="muted" />}
      {...props}
    />
  );
}
