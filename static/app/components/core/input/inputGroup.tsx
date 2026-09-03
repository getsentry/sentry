import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {InputProps} from '@sentry/scraps/input';

import type {FormSize, StrictCSSObject, Theme} from 'sentry/utils/theme';

// There is a cycle here if we import textarea from scraps.
// eslint-disable-next-line @sentry/no-relative-import-paths
import type {TextAreaProps} from '../textarea';
// eslint-disable-next-line @sentry/no-relative-import-paths
import {TextArea as CoreTextArea} from '../textarea';

import {Input as CoreInput} from './input';

interface InputStyleProps {
  leadingWidth?: number;
  size?: FormSize;
  trailingWidth?: number;
}

const InputItemsWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${p => p.theme.space.md};

  /* Do not use transform here to do alignment as it will create a new stacking
   * context, breaking things like dropdown menus */
  position: absolute;
  top: 0;
  bottom: 0;
`;

const itemsPadding = {
  md: 8,
  sm: 6,
  xs: 4,
} satisfies Record<NonNullable<InputStyleProps['size']>, number>;

const inputStyles = ({
  leadingWidth,
  trailingWidth,
  size = 'md',
  theme,
}: InputStyleProps & {theme: Theme}): StrictCSSObject => ({
  ...(leadingWidth && {
    paddingLeft: `calc(${theme.form[size].paddingLeft}px + ${itemsPadding[size]}px + ${leadingWidth}px)`,
  }),
  ...(trailingWidth && {
    paddingRight: `calc(${theme.form[size].paddingRight}px + ${itemsPadding[size]}px + ${trailingWidth}px)`,
  }),
});

const StyledInput = styled(CoreInput)<InputStyleProps>`
  ${inputStyles}
`;

const StyledTextArea = styled(CoreTextArea)<InputStyleProps>`
  ${inputStyles}
`;

const StyledLeadingItemsWrap = styled(InputItemsWrap)<{
  size: NonNullable<InputStyleProps['size']>;
  disablePointerEvents?: boolean;
}>`
  left: ${p => p.theme.form[p.size].paddingLeft + 1}px;
  ${p => p.disablePointerEvents && 'pointer-events: none;'}
`;

const StyledTrailingItemsWrap = styled(InputItemsWrap)<{
  size: NonNullable<InputStyleProps['size']>;
  disablePointerEvents?: boolean;
}>`
  right: ${p => p.theme.form[p.size].paddingRight + 1}px;
  ${p => p.disablePointerEvents && 'pointer-events: none;'}
`;

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
  setLeadingWidth?: Dispatch<SetStateAction<number | undefined>>;
  setTrailingWidth?: Dispatch<SetStateAction<number | undefined>>;
  /**
   * Width of the trailing items wrap, to be added to `Input`'s padding.
   */
  trailingWidth?: number;
}
const InputGroupContext = createContext<InputContext>({inputProps: {}});

/**
 * Wrapper for input group. To be used alongisde `Input`, `InputGroup.LeadingItems`,
 * and `InputGroup.TrailingItems`:
 *   <InputGroup>
 *     <InputGroup.LeadingItems> … </InputGroup.LeadingItems>
 *     <Input />
 *     <InputGroup.TrailingItems> … </InputGroup.TrailingItems>
 *   </InputGroup>
 */
export function InputGroup({children, ...props}: React.HTMLAttributes<HTMLDivElement>) {
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
    <InputGroupContext value={contextValue}>
      <InputGroupWrap disabled={inputProps.disabled} {...props}>
        {children}
      </InputGroupWrap>
    </InputGroupContext>
  );
}

function Input({ref, size, disabled, ...props}: InputProps) {
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

function TextArea({ref, size, disabled, ...props}: TextAreaProps) {
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

interface InputItemsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether to disable pointer events on the leading/trailing item wrap. This
   * should be set to true when none of the items inside the wrap are
   * interactive (e.g. a leading search icon). That way, mouse clicks will
   * fall through to the `Input` underneath and trigger a focus event.
   */
  disablePointerEvents?: boolean;
}

function useInputItemsWidthRef(
  setWidth: Dispatch<SetStateAction<number | undefined>> | undefined
) {
  return useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !setWidth) {
        return;
      }

      const updateWidth = () => {
        setWidth(node.offsetWidth);
      };

      // Measure synchronously when the node is mounted so the input padding is
      // correct before the browser paints. The observer handles children that
      // change size without replacing the items wrapper.
      updateWidth();

      const observer = new ResizeObserver(updateWidth);
      observer.observe(node);

      return () => {
        observer.disconnect();
        setWidth(undefined);
      };
    },
    [setWidth]
  );
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
  const {
    inputProps: {size = 'md', disabled},
    setLeadingWidth,
  } = useContext(InputGroupContext);
  const ref = useInputItemsWidthRef(setLeadingWidth);

  return (
    <StyledLeadingItemsWrap
      ref={ref}
      size={size}
      disablePointerEvents={disabled || disablePointerEvents}
      data-test-id="input-leading-items"
      {...props}
    >
      {children}
    </StyledLeadingItemsWrap>
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
  const {
    inputProps: {size = 'md', disabled},
    setTrailingWidth,
  } = useContext(InputGroupContext);
  const ref = useInputItemsWidthRef(setTrailingWidth);

  return (
    <StyledTrailingItemsWrap
      ref={ref}
      size={size}
      disablePointerEvents={disabled || disablePointerEvents}
      data-test-id="input-trailing-items"
      {...props}
    >
      {children}
    </StyledTrailingItemsWrap>
  );
}

InputGroup.Input = Input;
InputGroup.TextArea = TextArea;
InputGroup.LeadingItems = LeadingItems;
InputGroup.TrailingItems = TrailingItems;

const InputGroupWrap = styled('div')<{disabled?: boolean}>`
  position: relative;
  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.tokens.content.disabled};
    `}
`;
