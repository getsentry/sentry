import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import type {AlertProps} from 'sentry/components/core/alert';
import {IconCheckmark, IconInfo, IconWarning} from 'sentry/icons';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'subtle';

export interface DO_NOT_USE_ChonkAlertProps extends Omit<AlertProps, 'type'> {
  type: AlertVariant;
  size?: 'sm';
}

export const DO_NOT_USE_ChonkAlert = forwardRef<
  HTMLDivElement,
  DO_NOT_USE_ChonkAlertProps
>((props, ref) => {
  const {type, size, ...rest} = props;

  return (
    <AlertContainer ref={ref} {...rest}>
      <Flex justify="space-between" align="center">
        <AlertIcon type={type} />
        <Flex.Item grow={1}>
          <AlertMessage>{props.title}</AlertMessage>
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

// Dont return never just because we are throwing an error and TS will think the code
// is unreachable and try suggest us to remove it.
function unreachable(x: never) {
  return x;
}

const AlertContainer = styled('div')``;
const AlertMessage = styled('div')``;
