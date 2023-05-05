import styled from '@emotion/styled';

import {Button, ButtonProps} from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type Props = {
  text: string;
  children?: React.ReactNode;
  iconSize?: React.ComponentProps<typeof IconCopy>['size'];
  onError?: undefined | ((error: Error) => void);
} & Overwrite<
  Omit<ButtonProps, 'children'>,
  Partial<
    Pick<ButtonProps, 'aria-label'> & {onCopy: undefined | ((copiedText: string) => void)}
  >
>;

export function CopyToClipboardButton({onCopy, onError, text, ...props}: Props) {
  const {onClick, label} = useCopyToClipboard({
    text,
    onCopy,
    onError,
  });

  return (
    <CopyButton
      aria-label={label}
      size={props.size}
      title={label}
      tooltipProps={{delay: 0}}
      translucentBorder
      onClick={onClick}
      {...props}
    >
      <IconCopy size="xs" />
    </CopyButton>
  );
}

const CopyButton = styled(Button)`
  color: ${p => p.theme.subText};
`;
