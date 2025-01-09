import {useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaRadioProps} from '@react-aria/radio';
import {useRadio, useRadioGroup} from '@react-aria/radio';
import {Item, useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {RadioGroupProps, RadioGroupState} from '@react-stately/radio';
import {useRadioGroupState} from '@react-stately/radio';
import type {CollectionBase, ItemProps, Node} from '@react-types/shared';
import {LayoutGroup, motion} from 'framer-motion';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {FormSize} from 'sentry/utils/theme';

export interface SegmentedControlItemProps<Value extends string>
  extends Omit<ItemProps<any>, 'children'> {
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

type Priority = 'default' | 'primary';
export interface SegmentedControlProps<Value extends string>
  extends Omit<RadioGroupProps, 'value' | 'defaultValue' | 'onChange'>,
    CollectionBase<any> {
  defaultValue?: Value;
  disabled?: RadioGroupProps['isDisabled'];
  onChange?: (value: Value) => void;
  priority?: Priority;
  size?: FormSize;
  value?: Value;
}

const collectionFactory = (nodes: Iterable<Node<any>>) => new ListCollection(nodes);

export function SegmentedControl<Value extends string>({
  value,
  defaultValue,
  onChange,
  size = 'md',
  priority = 'default',
  disabled,
  ...props
}: SegmentedControlProps<Value>) {
  const ref = useRef<HTMLDivElement>(null);

  const collection = useCollection(props, collectionFactory);
  const ariaProps: RadioGroupProps = {
    ...props,
    // Cast value/defaultValue as string to comply with AriaRadioGroupProps. This is safe
    // as value and defaultValue are already strings (their type, Value, extends string)
    value: value as string,
    defaultValue: defaultValue as string,
    onChange: onChange && (val => onChange(val as Value)),
    orientation: 'horizontal',
    isDisabled: disabled,
  };

  const state = useRadioGroupState(ariaProps);
  const {radioGroupProps} = useRadioGroup(ariaProps, state);

  const collectionList = useMemo(() => [...collection], [collection]);

  return (
    <GroupWrap {...radioGroupProps} size={size} priority={priority} ref={ref}>
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
) => JSX.Element;

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
  nextKey,
  prevKey,
  size,
  priority,
  layoutGroupId,
  tooltip,
  tooltipOptions = {},
  icon,
  ...props
}: SegmentProps<Value>) {
  const ref = useRef<HTMLInputElement>(null);

  const {inputProps} = useRadio(props, state, ref);

  const prevOptionIsSelected = defined(prevKey) && state.selectedValue === prevKey;
  const nextOptionIsSelected = defined(nextKey) && state.selectedValue === nextKey;

  const isSelected = state.selectedValue === props.value;
  const showDivider = !isSelected && !nextOptionIsSelected;

  const {isDisabled} = props;
  const content = (
    <SegmentWrap
      size={size}
      isSelected={isSelected}
      isDisabled={isDisabled}
      data-test-id={props.value}
    >
      <SegmentInput {...inputProps} ref={ref} />
      {!isDisabled && (
        <SegmentInteractionStateLayer
          nextOptionIsSelected={nextOptionIsSelected}
          prevOptionIsSelected={prevOptionIsSelected}
        />
      )}
      {isSelected && (
        <SegmentSelectionIndicator
          layoutId={layoutGroupId}
          transition={{type: 'tween', ease: 'easeOut', duration: 0.2}}
          priority={priority}
          aria-hidden
          // Prevent animations until the user has made a change
          layoutDependency={isSelected}
        />
      )}

      <Divider visible={showDivider} role="separator" aria-hidden />

      <LabelWrap size={size} role="presentation">
        {icon}
        {/* Once an item is selected, it gets a heavier font weight and becomes slightly
        wider. To prevent layout shifts, we need a hidden container (HiddenLabel) that
        will always have normal weight to take up constant space; and a visible,
        absolutely positioned container (VisibleLabel) that doesn't affect the layout. */}
        {props.children && (
          <InnerLabelWrap role="presentation">
            <HiddenLabel aria-hidden>{props.children}</HiddenLabel>
            <VisibleLabel
              isSelected={isSelected}
              isDisabled={isDisabled}
              priority={priority}
              role="presentation"
            >
              {props.children}
            </VisibleLabel>
          </InnerLabelWrap>
        )}
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

const GroupWrap = styled('div')<{priority: Priority; size: FormSize}>`
  position: relative;
  display: inline-grid;
  grid-auto-flow: column;
  background: ${p =>
    p.priority === 'primary' ? p.theme.background : p.theme.backgroundTertiary};
  border: solid 1px ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  min-width: 0;

  ${p => p.theme.form[p.size]}
`;

const SegmentWrap = styled('label')<{
  isSelected: boolean;
  size: FormSize;
  isDisabled?: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  margin: 0;
  border-radius: calc(${p => p.theme.borderRadius} - 1px);
  cursor: ${p => (p.isDisabled ? 'default' : 'pointer')};
  min-height: 0;
  min-width: 0;

  ${p => p.theme.buttonPadding[p.size]}
  font-weight: ${p => p.theme.fontWeightNormal};

  ${p =>
    !p.isDisabled &&
    `
    &:hover {
      background-color: inherit;

      [role='separator'] {
        opacity: 0;
      }
    }
  `}

  ${p => p.isSelected && `z-index: 1;`}
`;

const SegmentInput = styled('input')`
  appearance: none;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  border-radius: ${p => p.theme.borderRadius};
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

const SegmentInteractionStateLayer = styled(InteractionStateLayer)<{
  nextOptionIsSelected: boolean;
  prevOptionIsSelected: boolean;
}>`
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: auto;
  height: auto;
  transform: none;

  /* Prevent small gaps between adjacent pairs of selected & hovered radios (due to their
  border radius) by extending the hovered radio's interaction state layer into and
  behind the selected radio. */
  transition:
    left 0.2s,
    right 0.2s;
  ${p => p.prevOptionIsSelected && `left: calc(-${p.theme.borderRadius} - 2px);`}
  ${p => p.nextOptionIsSelected && `right: calc(-${p.theme.borderRadius} - 2px);`}
`;

const SegmentSelectionIndicator = styled(motion.div)<{priority: Priority}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;

  ${p =>
    p.priority === 'primary'
      ? `
    background: ${p.theme.active};
    border-radius: ${p.theme.borderRadius};
    input:focus-visible ~ & {
      box-shadow: 0 0 0 3px ${p.theme.focus};
    }

    top: -1px;
    bottom: -1px;
    label:first-child > & {
      left: -1px;
    }
    label:last-child > & {
      right: -1px;
    }
  `
      : `
    background: ${p.theme.backgroundElevated};
    border-radius: calc(${p.theme.borderRadius} - 1px);
    box-shadow: 0 0 2px rgba(43, 34, 51, 0.32);
    input:focus-visible ~ & {
      box-shadow: 0 0 0 2px ${p.theme.focusBorder};
    }
  `}
`;

const LabelWrap = styled('span')<{size: FormSize}>`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${p => (p.size === 'xs' ? space(0.5) : space(0.75))};
  z-index: 1;
`;

const InnerLabelWrap = styled('span')`
  position: relative;
  display: flex;
  line-height: 1;
  min-width: 0;
`;

const HiddenLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  margin: 0 2px;
  visibility: hidden;
  user-select: none;
`;

function getTextColor({
  isDisabled,
  isSelected,
  priority,
  theme,
}: {
  isSelected: boolean;
  priority: Priority;
  theme: Theme;
  isDisabled?: boolean;
}) {
  if (isDisabled) {
    return `color: ${theme.subText};`;
  }

  if (isSelected) {
    return priority === 'primary'
      ? `color: ${theme.white};`
      : `color: ${theme.headingColor};`;
  }

  return `color: ${theme.textColor};`;
}

const VisibleLabel = styled('span')<{
  isSelected: boolean;
  priority: Priority;
  isDisabled?: boolean;
}>`
  ${p => p.theme.overflowEllipsis}

  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: color 0.25s ease-out;

  user-select: none;
  font-weight: ${p => (p.isSelected ? 600 : 400)};
  letter-spacing: ${p => (p.isSelected ? '-0.015em' : 'inherit')};
  text-align: center;
  line-height: ${p => p.theme.text.lineHeightBody};
  ${getTextColor}
`;

const Divider = styled('div')<{visible: boolean}>`
  position: absolute;
  top: 50%;
  right: 0;
  width: 0;
  height: 50%;
  transform: translate(1px, -50%);
  border-right: solid 1px ${p => p.theme.innerBorder};

  label:last-child > & {
    display: none;
  }

  ${p => !p.visible && `opacity: 0;`}
`;
