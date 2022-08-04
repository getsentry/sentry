import {forwardRef, ForwardRefRenderFunction, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Input, {InputProps} from 'sentry/components/input';
import space from 'sentry/styles/space';
import {FormSize} from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';

export interface InputControlProps extends InputProps {
  leadingItems?: React.ReactNode;
  trailingItems?: React.ReactNode;
}

/**
 * Does the same thing as Input (components/input), but adds support for
 * leading/trailing items.
 */
const InputControl: ForwardRefRenderFunction<HTMLInputElement, InputControlProps> = (
  {size = 'md', leadingItems, trailingItems, monospace, disabled, ...props},
  ref
) => {
  // We'll update the input's left and right padding whenever a breakpoint is crossed.
  // This is more efficient than ResizeObserver or listening to window resize events.
  const theme = useTheme();
  const isSmall = useMedia(`(max-width: ${theme.breakpoints.small})`);
  const isMedium = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const isLarge = useMedia(`(max-width: ${theme.breakpoints.large})`);
  const isXLarge = useMedia(`(max-width: ${theme.breakpoints.xlarge})`);
  const isXXLarge = useMedia(`(max-width: ${theme.breakpoints.xxlarge})`);

  // Manage leading items' width
  const leadingRef = useRef<HTMLDivElement | null>(null);
  const [leadingWidth, setLeadingWidth] = useState(0);
  useEffect(() => {
    if (!leadingRef.current) {
      return;
    }
    setLeadingWidth(leadingRef.current.offsetWidth);
  }, [leadingItems, isSmall, isMedium, isLarge, isXLarge, isXXLarge]);

  // Manage trailing items' width
  const trailingRef = useRef<HTMLDivElement | null>(null);
  const [trailingWidth, setTrailingWidth] = useState(0);
  useEffect(() => {
    if (!trailingRef.current) {
      return;
    }
    setTrailingWidth(trailingRef.current.offsetWidth);
  }, [trailingItems, isSmall, isMedium, isLarge, isXLarge, isXXLarge]);

  return (
    <Wrap disabled={disabled}>
      {leadingItems && (
        <LeadingItems ref={leadingRef} size={size}>
          {leadingItems}
        </LeadingItems>
      )}
      {trailingItems && (
        <TrailingItems ref={trailingRef} size={size}>
          {trailingItems}
        </TrailingItems>
      )}
      <Input
        {...props}
        ref={ref}
        size={size}
        disabled={disabled}
        leadingWidth={leadingWidth}
        trailingWidth={trailingWidth}
        monospace={monospace}
      />
    </Wrap>
  );
};

export default forwardRef(InputControl);

const Wrap = styled('div')<{disabled?: boolean}>`
  position: relative;
  ${p => p.disabled && `color: ${p.theme.disabled};`};
`;

const ItemsWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};

  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const LeadingItems = styled(ItemsWrap)<{size: FormSize}>`
  /* Add 1px to account for the input's border */
  left: ${p => p.theme.formPadding[p.size].paddingLeft + 1}px;
`;

const TrailingItems = styled(ItemsWrap)<{size: FormSize}>`
  /* Add 1px to account for the input's border */
  right: ${p => p.theme.formPadding[p.size].paddingRight + 1}px;
`;
