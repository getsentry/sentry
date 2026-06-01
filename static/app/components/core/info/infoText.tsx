import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import {Text, type TextProps} from '@sentry/scraps/text';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

export type InfoTextProps<T extends 'span' | 'p' | 'label' | 'div' | 'time'> =
  DistributedOmit<TextProps<T>, 'title' | 'variant'> & {
    title: React.ReactNode;
    variant?: TooltipProps['underlineColor'] | 'inherit';
  } & Pick<TooltipProps, 'position' | 'maxWidth'>;

export function InfoText<T extends 'span' | 'p' | 'label' | 'div' | 'time' = 'span'>({
  title,
  children,
  position,
  maxWidth,
  ...textProps
}: InfoTextProps<T>) {
  if (!title) {
    return <Text {...textProps}>{children}</Text>;
  }
  return (
    <Tooltip
      title={title}
      position={position}
      maxWidth={maxWidth}
      skipWrapper
      isHoverable
      showUnderline
      underlineColor={textProps.variant === 'inherit' ? undefined : textProps.variant}
    >
      <StyledText {...textProps} tabIndex={0}>
        {children}
      </StyledText>
    </Tooltip>
  );
}

const StyledText = styled(Text)`
  outline: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;
