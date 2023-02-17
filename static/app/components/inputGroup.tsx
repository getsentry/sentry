import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';

import _TextArea, {TextAreaProps} from 'sentry/components/forms/controls/textarea';
import _Input, {InputProps} from 'sentry/components/input';
import {space} from 'sentry/styles/space';
import {FormSize} from 'sentry/utils/theme';

interface InputContext {
  /**
   * Props passed to `Input` element (`size`, `disabled`), useful for styling
   * `InputGroup.LeadingItems` and `InputGroup.TrailingItems`.
   */
  inputProps: Pick<InputProps, 'size' | 'disabled'>;
  /**
   * Width of the leading items wrap, to be added to `Input`'s padding.
   */
  leadingWidth?: number;
  setInputProps?: (props: Pick<InputProps, 'size' | 'disabled'>) => void;
  setLeadingWidth?: (width: number) => void;
  setTrailingWidth?: (width: number) => void;
  /**
   * Width of the trailing items wrap, to be added to `Input`'s padding.
   */
  trailingWidth?: number;
}
export const InputGroupContext = createContext<InputContext>({inputProps: {}});

/**
 * Wrapper for input group. To be used alongisde `Input`, `InputGroup.LeadingItems`,
 * and `InputGroup.TrailingItems`:
 *   <InputGroup>
 *     <InputGroup.LeadingItems> … </InputGroup.LeadingItems>
 *     <Input />
 *     <InputGroup.TrailingItems> … </InputGroup.TrailingItems>
 *   </InputGroup>
 */
function InputGroup({children, ...props}: React.HTMLAttributes<HTMLDivElement>) {
  const [leadingWidth, setLeadingWidth] = useState<number>();
  const [trailingWidth, setTrailingWidth] = useState<number>();
  const [inputProps, setInputProps] = useState<Partial<InputProps>>({});

  const contextValue = useMemo(
    () => ({
      inputProps,
      setInputProps,
      leadingWidth,
      setLeadingWidth,
      trailingWidth,
      setTrailingWidth,
    }),
    [inputProps, leadingWidth, trailingWidth]
  );

  return (
    <InputGroupContext.Provider value={contextValue}>
      <InputGroupWrap disabled={inputProps.disabled} {...props}>
        {children}
      </InputGroupWrap>
    </InputGroupContext.Provider>
  );
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({size, disabled, ...props}, ref) => {
    const {leadingWidth, trailingWidth, setInputProps} = useContext(InputGroupContext);

    useLayoutEffect(() => {
      setInputProps?.({size, disabled});
    }, [size, disabled, setInputProps]);

    return (
      <StyledInput
        ref={ref}
        leadingWidth={leadingWidth}
        trailingWidth={trailingWidth}
        size={size}
        disabled={disabled}
        {...props}
      />
    );
  }
);

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({size, disabled, ...props}, ref) => {
    const {leadingWidth, trailingWidth, setInputProps} = useContext(InputGroupContext);

    useLayoutEffect(() => {
      setInputProps?.({size, disabled});
    }, [size, disabled, setInputProps]);

    return (
      <StyledTextArea
        ref={ref}
        leadingWidth={leadingWidth}
        trailingWidth={trailingWidth}
        size={size}
        disabled={disabled}
        {...props}
      />
    );
  }
);

interface InputItemsProps extends React.HTMLAttributes<HTMLDivElement> {
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
 *     <InputGroup.LeadingItems> … </InputGroup.LeadingItems>
 *     <Input />
 *   </InputGroup>
 */
function LeadingItems({children, disablePointerEvents, ...props}: InputItemsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const {
    inputProps: {size = 'md', disabled},
    setLeadingWidth,
  } = useContext(InputGroupContext);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    setLeadingWidth?.(ref.current.offsetWidth);
  }, [children, setLeadingWidth, size]);

  return (
    <InputLeadingItemsWrap
      ref={ref}
      size={size}
      disablePointerEvents={disabled || disablePointerEvents}
      data-test-id="input-leading-items"
      {...props}
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
 *     <InputGroup.TrailingItems> … </InputGroup.TrailingItems>
 *   </InputGroup>
 */
function TrailingItems({children, disablePointerEvents, ...props}: InputItemsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const {
    inputProps: {size = 'md', disabled},
    setTrailingWidth,
  } = useContext(InputGroupContext);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    setTrailingWidth?.(ref.current.offsetWidth);
  }, [children, setTrailingWidth, size]);

  return (
    <InputTrailingItemsWrap
      ref={ref}
      size={size}
      disablePointerEvents={disabled || disablePointerEvents}
      data-test-id="input-trailing-items"
      {...props}
    >
      {children}
    </InputTrailingItemsWrap>
  );
}

InputGroup.Input = Input;
InputGroup.TextArea = TextArea;
InputGroup.LeadingItems = LeadingItems;
InputGroup.TrailingItems = TrailingItems;

export {InputGroup};
export type {InputProps, TextAreaProps};

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

interface InputStyleProps {
  leadingWidth?: number;
  size?: FormSize;
  trailingWidth?: number;
}

const getInputStyles = ({
  leadingWidth,
  trailingWidth,
  size,
  theme,
}: InputStyleProps & {theme: Theme}) => css`
  ${leadingWidth &&
  `
    padding-left: calc(
      ${theme.formPadding[size ?? 'md'].paddingLeft}px * 1.5
      + ${leadingWidth}px
    );
  `}

  ${trailingWidth &&
  `
    padding-right: calc(
      ${theme.formPadding[size ?? 'md'].paddingRight}px * 1.5
      + ${trailingWidth}px
    );
  `}
`;

const StyledInput = styled(_Input)<InputStyleProps>`
  ${getInputStyles}
`;

const StyledTextArea = styled(_TextArea)<InputStyleProps>`
  ${getInputStyles}
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
