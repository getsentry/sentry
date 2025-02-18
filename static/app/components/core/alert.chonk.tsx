import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import type {AlertProps} from 'sentry/components/core/alert';
import {IconCheckmark, IconInfo, IconWarning} from 'sentry/icons';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import {DO_NOT_USE_chonk_space} from 'sentry/utils/theme/theme.chonk';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'subtle';

export interface DO_NOT_USE_ChonkAlertProps extends Omit<AlertProps, 'type'> {
  type: AlertVariant;
  size?: 'sm';
}

export const DO_NOT_USE_ChonkAlert = forwardRef<
  HTMLDivElement,
  DO_NOT_USE_ChonkAlertProps
>((props, ref) => {
  const theme = useTheme();
  const {type, size, ...rest} = props;

  const colors = getAlertVariantColors(theme, type);

  return (
    <AlertContainer ref={ref} {...rest} colors={colors} size={size}>
      <Flex justify="space-between" align="center" gap={DO_NOT_USE_chonk_space.sm}>
        <AlertIcon type={type} />
        <Flex.Item grow={1}>
          <AlertMessage>{props.children}</AlertMessage>
          {props.trailingItems && <Flex.Item>{props.trailingItems}</Flex.Item>}
        </Flex.Item>
      </Flex>
      {/* showExpand */}
      {/* isExpanded */}
    </AlertContainer>
  );
});

function AlertIcon({type}: {type: AlertVariant}): React.ReactNode {
  switch (type) {
    case 'info':
    case 'subtle':
      return <IconInfo />;
    case 'danger':
    case 'warning':
      return <IconWarning />;
    case 'success':
      return <IconCheckmark />;
    default:
      unreachable(type);
  }

  return null;
}

function getAlertVariantColors(theme: Theme, type: DO_NOT_USE_ChonkAlertProps['type']) {
  switch (type) {
    case 'info':
      return theme.alert.info;
    case 'success':
      return theme.alert.success;
    case 'warning':
      return theme.alert.warning;
    case 'danger':
      return theme.alert.error;
    case 'subtle':
      return theme.alert.muted;
  }
}

// Dont return never just because we are throwing an error and TS will think the code
// is unreachable and try suggest us to remove it.
function unreachable(x: never) {
  return x;
}

const AlertContainer = styled('div')<{
  colors: ReturnType<typeof getAlertVariantColors>;
  size: DO_NOT_USE_ChonkAlertProps['size'];
}>`
  color: ${p => p.colors.color};
  border: 2px solid ${p => p.colors.borderColor};
  background-color: ${p => p.colors.backgroundColor};
  border-radius: ${p => p.theme.borderRadius};

  padding: ${p =>
    p.size === 'sm'
      ? `${DO_NOT_USE_chonk_space.sm} ${DO_NOT_USE_chonk_space.md}`
      : `${DO_NOT_USE_chonk_space.lg} ${DO_NOT_USE_chonk_space.lg}`};

  &:hover {
    border: 2px solid ${p => p.colors._hover.borderColor};
  }
`;

const AlertMessage = styled('div')``;
