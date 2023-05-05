import {ComponentProps, useState} from 'react';

import {Button, ButtonProps} from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type Props = {
  text: string;
  iconSize?: ComponentProps<typeof IconCopy>['size'];
} & Overwrite<
  ButtonProps,
  Partial<
    Pick<ButtonProps, 'aria-label'> & {onCopy: undefined | ((copiedText: string) => void)}
  >
>;

export function CopyToClipboardButton({
  iconSize = 'xs',
  onCopy,
  onMouseLeave,
  text,
  ...props
}: Props) {
  const [tooltipState, setTooltipState] = useState<'copy' | 'copied' | 'error'>('copy');

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
      ? t('Copied')
      : t('Unable to copy');

  return (
    <Clipboard
      hideUnsupported
      onSuccess={() => {
        setTooltipState('copied');
        onCopy?.(text);
      }}
      onError={() => {
        setTooltipState('error');
      }}
      value={text}
    >
      <Button
        aria-label={t('Copy')}
        size={props.size || 'xs'}
        title={tooltipTitle}
        tooltipProps={{delay: 0, isHoverable: false, position: 'left'}}
        translucentBorder
        type="button"
        {...props}
        onMouseLeave={e => {
          setTooltipState('copy');
          onMouseLeave?.(e);
        }}
        icon={<IconCopy size={iconSize || props.size || 'xs'} color="subText" />}
      />
    </Clipboard>
  );
}
