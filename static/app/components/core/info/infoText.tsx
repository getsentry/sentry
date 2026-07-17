import {useState} from 'react';
import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import {Text, type TextProps} from '@sentry/scraps/text';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

type InfoTextBaseProps<T extends 'span' | 'p' | 'label' | 'div' | 'time'> =
  DistributedOmit<TextProps<T>, 'title' | 'variant' | 'ellipsis'> & {
    title: React.ReactNode;
    variant?: TooltipProps['underlineColor'] | 'inherit';
  } & Pick<TooltipProps, 'position' | 'maxWidth'>;

export type InfoTextProps<T extends 'span' | 'p' | 'label' | 'div' | 'time'> =
  | (InfoTextBaseProps<T> & {mode?: undefined})
  | (DistributedOmit<InfoTextBaseProps<T>, 'display' | 'wrap'> & {
      mode: 'overflowOnly';
    });

export function InfoText<T extends 'span' | 'p' | 'label' | 'div' | 'time' = 'span'>({
  title,
  children,
  position,
  maxWidth,
  mode,
  ...textProps
}: InfoTextProps<T>) {
  const isOverflowOnly = mode === 'overflowOnly';
  const [isOverflowing, setIsOverflowing] = useState(false);
  // Text's ellipsis props are mutually exclusive with display and wrap.
  const textPropsWithMode = {
    ...textProps,
    ...(isOverflowOnly ? {ellipsis: true as const} : {}),
  } as TextProps<T>;

  if (!title) {
    return <Text {...textPropsWithMode}>{children}</Text>;
  }
  return (
    <Tooltip
      title={title}
      position={position}
      maxWidth={maxWidth}
      showOnlyOnOverflow={isOverflowOnly}
      onOverflowChange={isOverflowOnly ? setIsOverflowing : undefined}
      skipWrapper
      isHoverable
      showUnderline={!isOverflowOnly}
      underlineColor={textProps.variant === 'inherit' ? undefined : textProps.variant}
    >
      <StyledText
        {...textPropsWithMode}
        tabIndex={isOverflowOnly && !isOverflowing ? undefined : 0}
      >
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
