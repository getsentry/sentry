import {useMemo, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaRadioProps} from '@react-aria/radio';
import {useRadio, useRadioGroup} from '@react-aria/radio';
import {Item, useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {RadioGroupProps, RadioGroupState} from '@react-stately/radio';
import {useRadioGroupState} from '@react-stately/radio';
import type {Node} from '@react-types/shared';
import type {CollectionChildren} from '@react-types/shared/src/collections';
import {LayoutGroup} from 'framer-motion';

import {DO_NOT_USE_getButtonStyles} from 'sentry/components/core/button/styles';
import type {TooltipProps} from 'sentry/components/core/tooltip';
import {Tooltip} from 'sentry/components/core/tooltip';
import {space} from 'sentry/styles/space';
import type {FormSize, Theme} from 'sentry/utils/theme';

type Priority = 'default' | 'primary';

const getChildTransforms = (count: number) => {
  return Array.from(
    {length: count},
    (_, index) => css`
      label:nth-of-type(${index + 1}) {
        transform: translateX(-${index}px);
      }
    `
  );
};

function getTextColor({
  isSelected,
  priority,
  theme,
}: {
  isSelected: boolean;
  priority: Priority;
  theme: Theme;
  isDisabled?: boolean;
}) {
  if (isSelected) {
    return priority === 'default' ? theme.colors.blue500 : undefined;
  }

  return theme.tokens.content.secondary;
}

const segmentedWrapPadding = {
  md: '10px 16px 10px 16px',
  sm: '8px 12px 8px 12px',
  xs: '6px 8px 6px 8px',
} as const;

interface SegmentedControlItemProps<Value extends string> {
  key: Value;
  children?: React.ReactNode;
  disabled?: boolean;
  /**
   * Optional icon to be rendered to the left of the segment label. Use this prop to
   * ensure proper vertical alignment.
   *
   * NOTE: if the segment contains only an icon and no text label (i.e. `children` is
   * not defined), then an `aria-label` must be provided for screen reader support.
   */
  icon?: React.ReactNode;
  /** A string representation of the item's contents */
  textValue?: string;
  /**
   * Optional tooltip that appears when the use hovers over the segment. Avoid using
   * tooltips if there are other, more visible ways to display the same information.
   */
  tooltip?: React.ReactNode;
  /**
   * Additional props to be passed into <Tooltip />.
   */
  tooltipOptions?: Omit<TooltipProps, 'children' | 'title' | 'className'>;
}

interface SegmentedControlProps<Value extends string>
  extends Omit<RadioGroupProps, 'value' | 'defaultValue' | 'onChange' | 'isDisabled'> {
  children: CollectionChildren<Value>;
  onChange: (value: Value) => void;
  value: Value;
  disabled?: RadioGroupProps['isDisabled'];
  priority?: Priority;
  size?: FormSize;
}

const collectionFactory = (nodes: Iterable<Node<any>>) => new ListCollection(nodes);

export function SegmentedControl<Value extends string>({
  value,
  onChange,
  size = 'md',
  priority = 'default',
  disabled,
  ...props
}: SegmentedControlProps<Value>) {
  const ref = useRef<HTMLDivElement>(null);

  const collection = useCollection(props as any, collectionFactory);
  const ariaProps = {
    ...props,
    value,
    onChange: onChange as (value: string) => void,
    orientation: 'horizontal',
    isDisabled: disabled,
  } satisfies RadioGroupProps;

  const state = useRadioGroupState(ariaProps);
  const {radioGroupProps} = useRadioGroup(ariaProps, state);

  const collectionList = useMemo(() => [...collection], [collection]);

  return (
    <GroupWrap
      {...radioGroupProps}
      size={size}
      priority={priority}
      ref={ref}
      listSize={collectionList.length}
    >
      <LayoutGroup id={radioGroupProps.id}>
        {collectionList.map(option => (
          <Segment
            {...option.props}
            key={option.key}
            nextKey={option.nextKey}
            prevKey={option.prevKey}
            value={String(option.key)}
            isDisabled={option.props.disabled || disabled}
            state={state}
            size={size}
            priority={priority}
            layoutGroupId={radioGroupProps.id}
          >
            {option.rendered}
          </Segment>
        ))}
      </LayoutGroup>
    </GroupWrap>
  );
}

SegmentedControl.Item = Item as <Value extends string>(
  props: SegmentedControlItemProps<Value>
) => React.JSX.Element;

interface SegmentProps<Value extends string>
  extends SegmentedControlItemProps<Value>,
    AriaRadioProps {
  lastKey: string;
  layoutGroupId: string;
  priority: Priority;
  size: FormSize;
  state: RadioGroupState;
  nextKey?: string;
  prevKey?: string;
}

function Segment<Value extends string>({
  state,
  size,
  priority,
  tooltip,
  tooltipOptions = {},
  icon,
  ...props
}: SegmentProps<Value>) {
  const ref = useRef<HTMLInputElement>(null);

  const {inputProps} = useRadio(props, state, ref);

  const isSelected = state.selectedValue === props.value;

  const {isDisabled} = props;

  const label = <VisibleLabel>{props.children}</VisibleLabel>;

  const content = (
    <SegmentWrap
      size={size}
      isSelected={isSelected}
      isDisabled={isDisabled}
      priority={priority}
      data-test-id={props.value}
      aria-checked={isSelected}
      aria-disabled={isDisabled}
    >
      <SegmentInput {...inputProps} ref={ref} />

      <LabelWrap
        size={size}
        isSelected={isSelected}
        priority={priority}
        role="presentation"
      >
        {icon}
        {props.children && label}
      </LabelWrap>
    </SegmentWrap>
  );

  if (tooltip) {
    return (
      <Tooltip
        skipWrapper
        title={tooltip}
        {...{delay: 500, position: 'bottom', ...tooltipOptions}}
      >
        {content}
      </Tooltip>
    );
  }

  return content;
}

const GroupWrap = styled('div')<{
  listSize: number;
  priority: Priority;
  size: FormSize;
}>`
  position: relative;
  display: inline-grid;
  grid-auto-flow: column;
  min-width: 0;

  font-size: ${p => p.theme.form[p.size].fontSize};
  height: ${p => p.theme.form[p.size].height};
  line-height: ${p => p.theme.form[p.size].lineHeight};
  min-height: ${p => p.theme.form[p.size].minHeight};

  & > label:first-child {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  & > label:not(:first-child):not(:last-child) {
    border-radius: 0;
  }

  & > label:last-child {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  ${p => getChildTransforms(p.listSize)}
`;

const SegmentWrap = styled('label')<{
  isSelected: boolean;
  priority: Priority;
  size: FormSize;
  isDisabled?: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  margin: 0;
  cursor: ${p => (p.isDisabled ? 'default' : 'pointer')};
  min-height: 0;
  min-width: 0;
  z-index: ${p => (p.isSelected ? 1 : undefined)};

  padding: ${p => segmentedWrapPadding[p.size]};
  font-weight: ${p => p.theme.font.weight.sans.regular};

  ${p => ({
    ...DO_NOT_USE_getButtonStyles({
      ...p,
      disabled: p.isDisabled,
      priority: p.isSelected && p.priority === 'primary' ? 'primary' : 'default',
    }),
  })}

  &:has(input:focus-visible) {
    ${p => p.theme.focusRing()};

    /* Hide fallback ring when :has works */
    span {
      box-shadow: none !important;
    }
  }

  /* Fallback ring (for Firefox, where :has doesn't work) */
  input:focus-visible + span {
    ${({theme}) => theme.focusRing()};
  }
`;

const SegmentInput = styled('input')`
  appearance: none;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  border-radius: ${p => p.theme.radius.md};
  transition: box-shadow 0.125s ease-out;
  z-index: -1;

  /* Reset global styles */
  && {
    padding: 0;
    margin: 0;
  }

  &:focus {
    outline: none;
  }
`;

const LabelWrap = styled('span')<{
  isSelected: boolean;
  priority: Priority;
  size: FormSize;
}>`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${p => (p.size === 'xs' ? space(0.5) : space(0.75))};
  z-index: 1;
  color: ${p => getTextColor(p)};
`;

const VisibleLabel = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-align: center;
`;
