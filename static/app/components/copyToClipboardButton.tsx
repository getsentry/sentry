import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconCopy} from 'sentry/icons';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type Props = {
  text: string;
  onError?: undefined | ((error: Error) => void);
} & Overwrite<
  Omit<ButtonProps, 'children'>,
  Partial<
    Pick<ButtonProps, 'aria-label'> & {onCopy: undefined | ((copiedText: string) => void)}
  >
>;

export function CopyToClipboardButton({
  onCopy,
  onError,
  text,
  onClick: passedOnClick,
  ...props
}: Props) {
  const {onClick, label} = useCopyToClipboard({
    text,
    onCopy,
    onError,
  });

  return (
    <Button
      aria-label={label}
      title={label}
      tooltipProps={{delay: 0}}
      translucentBorder
      onClick={e => {
        onClick();
        passedOnClick?.(e);
      }}
      icon={<IconCopy color="subText" />}
      {...props}
    />
  );
}
