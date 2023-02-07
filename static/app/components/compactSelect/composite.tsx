import {Children, useMemo} from 'react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {Item} from '@react-stately/collections';

import space from 'sentry/styles/space';

import {Control, ControlProps} from './control';
import {ListBox, MultipleListBoxProps, SingleListBoxProps} from './listBox';
import {SelectOption} from './types';

interface BaseCompositeSelectRegion<Value extends React.Key> {
  options: SelectOption<Value>[];
  key?: React.Key;
  label?: React.ReactNode;
}

/**
 * A single-selection (only one option can be selected at a time) "region" inside a
 * composite select. Each "region" is a separated, self-contained select box (each
 * renders as a list box with its own list state) whose selection values don't interfere
 * with one another.
 */
export interface SingleCompositeSelectRegion<Value extends React.Key>
  extends BaseCompositeSelectRegion<Value>,
    Omit<
      SingleListBoxProps<Value>,
      'children' | 'items' | 'compositeIndex' | 'size' | 'onChange'
    > {
  onChange: (value: Value) => void;
}

/**
 * A multiple-selection (multiple options can be selected at the same time) "region"
 * inside a composite select. Each "region" is a separated, self-contained select box
 * (each renders as a list box with its own list state) whose selection values don't
 * interfere with one another.
 */
export interface MultipleCompositeSelectRegion<Value extends React.Key>
  extends BaseCompositeSelectRegion<Value>,
    Omit<
      MultipleListBoxProps<Value>,
      'children' | 'items' | 'compositeIndex' | 'size' | 'onChange'
    > {
  onChange: (values: Value[]) => void;
}

/**
 * A "region" inside a composite select. Each "region" is a separated, self-contained
 * select box (each renders as a list box with its own list state) whose selection
 * values don't interfere with one another.
 */
export type CompositeSelectRegion<Value extends React.Key> =
  | SingleCompositeSelectRegion<Value>
  | MultipleCompositeSelectRegion<Value>;

/**
 * A React child inside CompositeSelect. This helps ensure that the only non-falsy child
 * allowed inside CompositeSelect is CompositeSelect.Region
 */
type CompositeSelectChild =
  | React.ReactElement<CompositeSelectRegion<React.Key>>
  | false
  | null
  | undefined;

export interface CompositeSelectProps extends ControlProps {
  /**
   * The "regions" inside this composite selector. Each region functions as a separated,
   * self-contained select box (each renders as a list box with its own list state)
   * whose values don't interfere with one another.
   */
  children: CompositeSelectChild | CompositeSelectChild[];
  /**
   * Whether to close the menu upon selection. This prop applies to the entire selector
   * and functions as a fallback value. Each composite region also accepts the same
   * prop, which will take precedence over this one.
   */
  closeOnSelect?: SingleListBoxProps<React.Key>['closeOnSelect'];
}

/**
 * Flexible select component with a customizable trigger button
 */
function CompositeSelect({
  children,
  // Control props
  disabled,
  size = 'md',
  closeOnSelect,
  ...controlProps
}: CompositeSelectProps) {
  return (
    <Control {...controlProps} size={size} disabled={disabled}>
      <FocusScope>
        <RegionsWrap>
          {Children.map(children, (child, index) => {
            if (!child) {
              return null;
            }

            return (
              <Region
                {...child.props}
                size={size}
                compositeIndex={index}
                closeOnSelect={child.props.closeOnSelect ?? closeOnSelect}
              />
            );
          })}
        </RegionsWrap>
      </FocusScope>
    </Control>
  );
}

/**
 * A "region" inside composite selectors. Each "region" is a separated, self-contained
 * select box (each renders as a list box with its own list state) whose selection
 * values don't interfere with one another.
 */
CompositeSelect.Region = function <Value extends React.Key>(
  _props: CompositeSelectRegion<Value>
) {
  // This pseudo-component not meant to be rendered. It only functions as a props vessel
  // and composable child to `CompositeSelect`. `CompositeSelect` iterates over all child
  // instances of `CompositeSelect.Region` and renders `Region` with the specified props.
  return null;
};

export default CompositeSelect;

type RegionProps<Value extends React.Key> = CompositeSelectRegion<Value> & {
  compositeIndex: SingleListBoxProps<Value>['compositeIndex'];
  size: SingleListBoxProps<Value>['size'];
};

function Region<Value extends React.Key>({
  options,
  value,
  defaultValue,
  onChange,
  multiple,
  disallowEmptySelection,
  isOptionDisabled,
  closeOnSelect,
  size,
  compositeIndex,
  label,
  ...props
}: RegionProps<Value>) {
  // Combine list box props into an object with two clearly separated types, one where
  // `multiple` is true and the other where it's not. Necessary to avoid TS errors.
  const listBoxProps = useMemo(() => {
    if (multiple) {
      return {
        multiple,
        value,
        defaultValue,
        closeOnSelect,
        onChange: opts => onChange?.(opts.map(opt => opt.value)),
      };
    }
    return {
      multiple,
      value,
      defaultValue,
      closeOnSelect,
      onChange: opt => onChange?.(opt ? opt.value : null),
    };
  }, [multiple, value, defaultValue, onChange, closeOnSelect]);

  const optionsWithKey = useMemo<SelectOption<Value>[]>(
    () => options.map(item => ({...item, key: item.value})),
    [options]
  );

  return (
    <ListBox
      {...props}
      {...listBoxProps}
      items={optionsWithKey}
      disallowEmptySelection={disallowEmptySelection}
      isOptionDisabled={isOptionDisabled}
      shouldFocusWrap={false}
      compositeIndex={compositeIndex}
      size={size}
      label={label}
    >
      {(opt: SelectOption<Value>) => (
        <Item key={opt.value} {...opt}>
          {opt.label}
        </Item>
      )}
    </ListBox>
  );
}

const RegionsWrap = styled('div')`
  min-height: 0;
  overflow: auto;
  padding: ${space(0.5)} 0;

  /* Remove padding inside list boxes */
  > ul {
    padding: 0;
  }
`;
