import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import _TextArea from 'sentry/components/forms/controls/textarea';
import _Input, {InputProps} from 'sentry/components/input';
import space from 'sentry/styles/space';
import {FormSize} from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';

interface InputContext {
  /**
   * Props to be passed to `Input`. When `InputGroup` is used, it is
   * recommended to add input props (`size`, `disabled`) to `InputGroup`
   * rather than `Input`, so that other elements in the group
   * (`InputLeadingItems`, `InputTrailingItems`) also know about them.
   */
  inputProps: Partial<InputProps>;
  /**
   * Width of the leading items wrap, to be added to `Input`'s padding.
   */
  leadingWidth?: number;
  setLeadingWidth?: (width: number) => void;
  setTrailingWidth?: (width: number) => void;
  /**
   * Width of the trailing items wrap, to be added to `Input`'s padding.
   */
  trailingWidth?: number;
}
export const InputGroupContext = createContext<InputContext>({inputProps: {}});

/**
 * Context provider for input group. To be used alongisde `Input`, `InputLeadingItems`,
 * and `InputTrailingItems`:
 *   <InputGroup>
 *     <InputLeadingItems> … </InputLeadingItems>
 *     <Input />
 *     <InputTrailingItems> … </InputTrailingItems>
 *   </InputGroup>
 */
export function InputGroup({children, ...inputProps}: InputProps) {
  const [leadingWidth, setLeadingWidth] = useState<number>();
  const [trailingWidth, setTrailingWidth] = useState<number>();

  const contextValue = useMemo(
    () => ({inputProps, leadingWidth, setLeadingWidth, trailingWidth, setTrailingWidth}),
    [inputProps, leadingWidth, trailingWidth]
  );

  return (
    <InputGroupContext.Provider value={contextValue}>
      <InputGroupWrap disabled={inputProps.disabled}>{children}</InputGroupWrap>
    </InputGroupContext.Provider>
  );
}

export {InputProps};
export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {inputProps, leadingWidth, trailingWidth} = useContext(InputGroupContext);

  return (
    <StyledInput
      ref={ref}
      leadingWidth={leadingWidth}
      trailingWidth={trailingWidth}
      {...inputProps}
      {...props}
    />
  );
});

/**
 * Returns an array of media query matches, one for each breakpoint. We'll
 * re-calculate the leading/trailing widths when any of these values changes.
 */
function useBreakpointMatches() {
  const theme = useTheme();
  const isSmall = useMedia(`(max-width: ${theme.breakpoints.small})`);
  const isMedium = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const isLarge = useMedia(`(max-width: ${theme.breakpoints.large})`);
  const isXLarge = useMedia(`(max-width: ${theme.breakpoints.xlarge})`);
  const isXXLarge = useMedia(`(max-width: ${theme.breakpoints.xxlarge})`);

  return [isSmall, isMedium, isLarge, isXLarge, isXXLarge];
}

interface InputItemsProps {
  children?: React.ReactNode;
  /**
   * Whether to disable pointer events on the leading/trailing item wrap. This
   * should be set to true when none of the items inside the wrap are
   * interactive (e.g. a leading search icon). That way, mouse clicks will
   * fall through to the `Input` underneath and trigger a focus event.
   */
  disablePointerEvents?: boolean;
}

/**
 * Container for leading input items (e.g. a search icon). To be wrapped
 * inside `InputGroup`:
 *   <InputGroup>
 *     <InputLeadingItems> … </InputLeadingItems>
 *     <Input />
 *   </InputGroup>
 */
export function InputLeadingItems({children, disablePointerEvents}: InputItemsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const {
    inputProps: {size = 'md', disabled},
    setLeadingWidth,
  } = useContext(InputGroupContext);
  const breakpointMatches = useBreakpointMatches();

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    setLeadingWidth?.(ref.current.offsetWidth);
  }, [children, setLeadingWidth, breakpointMatches, size]);

  return (
    <InputLeadingItemsWrap
      ref={ref}
      size={size}
      disablePointerEvents={disabled || disablePointerEvents}
      data-test-id="input-leading-items"
    >
      {children}
    </InputLeadingItemsWrap>
  );
}

/**
 * Container for trailing input items (e.g. a clear button). To be wrapped
 * inside `InputGroup`:
 *   <InputGroup>
 *     <Input />
 *     <InputTrailingItems> … </InputTrailingItems>
 *   </InputGroup>
 */
export function InputTrailingItems({children, disablePointerEvents}: InputItemsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const {
    inputProps: {size = 'md', disabled},
    setTrailingWidth,
  } = useContext(InputGroupContext);
  const breakpointMatches = useBreakpointMatches();

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    setTrailingWidth?.(ref.current.offsetWidth);
  }, [children, setTrailingWidth, breakpointMatches, size]);

  return (
    <InputTrailingItemsWrap
      ref={ref}
      size={size}
      disablePointerEvents={disabled || disablePointerEvents}
      data-test-id="input-trailing-items"
    >
      {children}
    </InputTrailingItemsWrap>
  );
}

export const InputGroupWrap = styled('div')<{disabled?: boolean}>`
  position: relative;
  ${p => p.disabled && `color: ${p.theme.disabled};`};
`;

const InputItemsWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};

  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const StyledInput = styled(_Input)<{
  leadingWidth?: number;
  size?: FormSize;
  trailingWidth?: number;
}>`
  ${p =>
    p.leadingWidth &&
    `
      padding-left: calc(
        ${p.theme.formPadding[p.size ?? 'md'].paddingLeft}px * 1.5
        + ${p.leadingWidth}px
      );
    `}

  ${p =>
    p.trailingWidth &&
    `
      padding-right: calc(
        ${p.theme.formPadding[p.size ?? 'md'].paddingRight}px * 1.5
        + ${p.trailingWidth}px
      );
    `}
`;

const InputLeadingItemsWrap = styled(InputItemsWrap)<{
  size: FormSize;
  disablePointerEvents?: boolean;
}>`
  left: ${p => p.theme.formPadding[p.size].paddingLeft + 1}px;
  ${p => p.disablePointerEvents && `pointer-events: none;`}
`;

const InputTrailingItemsWrap = styled(InputItemsWrap)<{
  size: FormSize;
  disablePointerEvents?: boolean;
}>`
  right: ${p => p.theme.formPadding[p.size].paddingRight * 0.75 + 1}px;
  ${p => p.disablePointerEvents && `pointer-events: none;`}
`;
