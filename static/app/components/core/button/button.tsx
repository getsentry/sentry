// import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

// import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import {
  DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES,
  DO_NOT_USE_getButtonStyles as getButtonStyles,
} from './styles';
import type {DO_NOT_USE_ButtonProps as ButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

export type {ButtonProps};

export function Button({
  size = 'md',
  disabled,
  type = 'button',
  tooltipProps,
  busy,
  ...props
}: ButtonProps) {
  const {
    handleClick,
    // hasChildren,
    accessibleLabel,
  } = useButtonFunctionality({
    ...props,
    type,
    disabled,
    busy,
  });

  // const iconGap =
  //   props.icon && hasChildren
  //     ? size === 'xs' || size === 'zero'
  //       ? 'sm'
  //       : 'md'
  //     : undefined;

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <StyledButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        aria-busy={busy}
        disabled={disabled}
        // style={{ gap: iconGap }}
        size={size}
        type={type}
        busy={busy}
        {...props}
        onClick={handleClick}
        role="button"
        // visibility={busy ? 'hidden' : undefined}
      >
        {props.icon && (
          <IconDefaultsProvider size={BUTTON_ICON_SIZES[size]}>
            {props.icon}
          </IconDefaultsProvider>
        )}
        {props.children}
        {/* {busy ? <BusySpinner role="status" aria-label="Busy" /> : null} */}
      </StyledButton>
    </Tooltip>
  );
}

const StyledButton = styled('button')<ButtonProps>`
  ${p => getButtonStyles(p as any)}
`;

// const spin = keyframes`
//   to {
//     transform: rotate(360deg);
//   }
// `;

// const BusySpinner = styled('span')`
//   grid-area: 1 / 1;

//   &::after {
//     content: '';
//     display: block;
//     width: 1em;
//     height: 1em;
//     border-radius: 50%;
//     border: 2px solid currentColor;
//     border-top-color: transparent;
//     animation: ${spin} 0.6s linear infinite;
//   }
// `;
