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
  md: 4,
  sm: 4,
  xs: 2,
} satisfies Record<NonNullable<InputStyleProps['size']>, number>;

const itemsInset = {
  md: 12,
  sm: 8,
  xs: 4,
} satisfies Record<NonNullable<InputStyleProps['size']>, number>;

const inputStyles = ({
  size = 'md',
  theme,
  leadingWidth,
  trailingWidth,
}: InputStyleProps & {theme: Theme}): StrictCSSObject => ({
  paddingLeft: `calc(${itemsInset[size] - 1 + itemsPadding[size]}px + var(--input-leading-width, ${leadingWidth || theme.form[size].paddingLeft - itemsInset[size] + 1 - itemsPadding[size]}px))`,
  paddingRight: `calc(${itemsInset[size] - 1 + itemsPadding[size]}px + var(--input-trailing-width, ${trailingWidth || theme.form[size].paddingRight - itemsInset[size] + 1 - itemsPadding[size]}px))`,
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
  left: var(--input-items-inset, ${p => itemsInset[p.size]}px);
  > [data-chip]:first-child {
    margin-left: calc(
      ${p => p.theme.form[p.size].paddingLeft - itemsInset[p.size]}px -
        var(--chip-inline-padding)
    );
  }
  > [role='button']:first-child {
    margin-left: max(
      calc(1px - var(--input-items-inset, ${p => itemsInset[p.size]}px)),
      calc(-1 * var(--button-inline-padding, 0px))
    );
  }
  ${p => p.disablePointerEvents && 'pointer-events: none;'}
`;

const StyledTrailingItemsWrap = styled(InputItemsWrap)<{
  size: NonNullable<InputStyleProps['size']>;
  disablePointerEvents?: boolean;
}>`
  right: var(--input-items-inset, ${p => itemsInset[p.size]}px);
  > [data-chip]:last-child {
    margin-right: calc(
      ${p => p.theme.form[p.size].paddingRight - itemsInset[p.size]}px -
        var(--chip-inline-padding)
    );
  }
  > [role='button']:last-child {
    margin-right: max(
      calc(1px - var(--input-items-inset, ${p => itemsInset[p.size]}px)),
      calc(-1 * var(--button-inline-padding, 0px))
    );
  }
  ${p => p.disablePointerEvents && 'pointer-events: none;'}
`;

interface InputContext {
  /**
   * Props passed to `Input` element (`size`, `disabled`), useful for styling
   * `InputGroup.LeadingItems` and `InputGroup.TrailingItems`.
   */
  inputProps: Pick<InputProps, 'size' | 'disabled'>;
  leadingWidth?: number;
  setInputProps?: (props: Pick<InputProps, 'size' | 'disabled'>) => void;
  setLeadingWidth?: Dispatch<SetStateAction<number | undefined>>;
  setTrailingWidth?: Dispatch<SetStateAction<number | undefined>>;
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
      trailingWidth,
      setLeadingWidth,
      setTrailingWidth,
    }),
    [inputProps, leadingWidth, trailingWidth]
  );

  return (
    <InputGroupContext value={contextValue}>
      <InputGroupWrap disabled={inputProps.disabled} data-input-group="" {...props}>
        {children}
      </InputGroupWrap>
    </InputGroupContext>
  );
}

function Input({ref, size, disabled, ...props}: InputProps) {
  const {setInputProps, leadingWidth, trailingWidth} = useContext(InputGroupContext);

  useLayoutEffect(() => {
    setInputProps?.({size, disabled});
  }, [size, disabled, setInputProps]);

  return (
    <StyledInput
      ref={ref}
      leadingWidth={leadingWidth}
      trailingWidth={trailingWidth}
      size={size}
      data-input-size={size ?? 'md'}
      disabled={disabled}
      {...props}
    />
  );
}

function TextArea({ref, size, disabled, ...props}: TextAreaProps) {
  const {setInputProps, leadingWidth, trailingWidth} = useContext(InputGroupContext);

  useLayoutEffect(() => {
    setInputProps?.({size, disabled});
  }, [size, disabled, setInputProps]);

  return (
    <StyledTextArea
      ref={ref}
      leadingWidth={leadingWidth}
      trailingWidth={trailingWidth}
      size={size}
      data-input-size={size ?? 'md'}
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

export function updateInputGroupItemsWidth(node: HTMLElement) {
  const group = node.closest<HTMLElement>('[data-input-group]');
  const side = node.dataset.inputSide;
  const width = node.offsetWidth;
  if (width) {
    group?.style.setProperty(`--input-${side}-width`, `${width}px`);
  } else {
    group?.style.removeProperty(`--input-${side}-width`);
  }
  return width;
}

function useInputItemsWidthRef(
  setWidth: Dispatch<SetStateAction<number | undefined>> | undefined
) {
  return useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }

      const group = node.closest<HTMLElement>('[data-input-group]');
      const updateWidth = () => setWidth?.(updateInputGroupItemsWidth(node));
      updateWidth();
      const observer = new ResizeObserver(updateWidth);
      observer.observe(node);

      return () => {
        observer.disconnect();
        const side = node.dataset.inputSide;
        group?.style.removeProperty(`--input-${side}-width`);
        setWidth?.(undefined);
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
      data-input-side="leading"
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
      data-input-side="trailing"
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
  --input-items-inset: 12px;
  --input-leading-width: initial;
  --input-trailing-width: initial;
  &:has(> [data-input-size='sm']) {
    --input-items-inset: 8px;
  }
  &:has(> [data-input-size='xs']) {
    --input-items-inset: 4px;
  }
  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.tokens.content.disabled};
    `}
`;
