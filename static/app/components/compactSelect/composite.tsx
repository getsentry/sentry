import {Children, useMemo} from 'react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {Item} from '@react-stately/collections';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {Control, ControlProps} from './control';
import {List, MultipleListProps, SingleListProps} from './list';
import {EmptyMessage} from './styles';
import {SelectOption} from './types';

interface BaseCompositeSelectRegion<Value extends React.Key> {
  options: SelectOption<Value>[];
  key?: React.Key;
  label?: React.ReactNode;
}

/**
 * A single-selection (only one option can be selected at a time) "region" inside a
 * composite select. Each "region" is a separated, self-contained selectable list (each
 * renders as a `ul` with its own list state) whose selection values don't interfere
 * with one another.
 */
export interface SingleCompositeSelectRegion<Value extends React.Key>
  extends BaseCompositeSelectRegion<Value>,
    Omit<
      SingleListProps<Value>,
      'children' | 'items' | 'grid' | 'compositeIndex' | 'size'
    > {}

/**
 * A multiple-selection (multiple options can be selected at the same time) "region"
 * inside a composite select. Each "region" is a separated, self-contained selectable
 * list (each renders as a `ul` with its own list state) whose selection values don't
 * interfere with one another.
 */
export interface MultipleCompositeSelectRegion<Value extends React.Key>
  extends BaseCompositeSelectRegion<Value>,
    Omit<
      MultipleListProps<Value>,
      'children' | 'items' | 'grid' | 'compositeIndex' | 'size'
    > {}

/**
 * A "region" inside a composite select. Each "region" is a separated, self-contained
 * selectable list (each renders as a `ul` with its own list state) whose selection
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
   * self-contained selectable list (each renders as a `ul` with its own list state)
   * whose values don't interfere with one another.
   */
  children: CompositeSelectChild | CompositeSelectChild[];
  /**
   * Whether to close the menu upon selection. This prop applies to the entire selector
   * and functions as a fallback value. Each composite region also accepts the same
   * prop, which will take precedence over this one.
   */
  closeOnSelect?: SingleListProps<React.Key>['closeOnSelect'];
}

/**
 * Flexible select component with a customizable trigger button
 */
function CompositeSelect({
  children,
  // Control props
  grid,
  disabled,
  emptyMessage,
  size = 'md',
  closeOnSelect,
  ...controlProps
}: CompositeSelectProps) {
  return (
    <Control {...controlProps} grid={grid} size={size} disabled={disabled}>
      <FocusScope>
        <RegionsWrap>
          {Children.map(children, (child, index) => {
            if (!child) {
              return null;
            }

            return (
              <Region
                {...child.props}
                grid={grid}
                size={size}
                compositeIndex={index}
                closeOnSelect={child.props.closeOnSelect ?? closeOnSelect}
              />
            );
          })}

          {/* Only displayed when all lists (regions) are empty */}
          <EmptyMessage>{emptyMessage ?? t('No options found')}</EmptyMessage>
        </RegionsWrap>
      </FocusScope>
    </Control>
  );
}

/**
 * A "region" inside composite selectors. Each "region" is a separated, self-contained
 * selectable list (each renders as a `ul` with its own list state) whose selection
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

export {CompositeSelect};

type RegionProps<Value extends React.Key> = CompositeSelectRegion<Value> & {
  compositeIndex: SingleListProps<Value>['compositeIndex'];
  grid: SingleListProps<Value>['grid'];
  size: SingleListProps<Value>['size'];
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
  // Combine list props into an object with two clearly separated types, one where
  // `multiple` is true and the other where it's not. Necessary to avoid TS errors.
  const listProps = useMemo(() => {
    if (multiple) {
      return {
        multiple,
        value,
        defaultValue,
        closeOnSelect,
        onChange,
      };
    }
    return {
      multiple,
      value,
      defaultValue,
      closeOnSelect,
      onChange,
    };
  }, [multiple, value, defaultValue, onChange, closeOnSelect]);

  const optionsWithKey = useMemo<SelectOption<Value>[]>(
    () => options.map(item => ({...item, key: item.value})),
    [options]
  );

  return (
    <List
      {...props}
      {...listProps}
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
    </List>
  );
}

const RegionsWrap = styled('div')`
  min-height: 0;
  overflow: auto;
  padding: ${space(0.5)} 0;

  /* Add 1px to top padding if preceded by menu header, to account for the header's
  shadow border */
  [data-menu-has-header='true'] > div > & {
    padding-top: calc(${space(0.5)} + 1px);
  }

  /* Add 1px to bottom padding if succeeded by menu footer, to account for the footer's
  shadow border */
  [data-menu-has-footer='true'] > div > & {
    padding-bottom: calc(${space(0.5)} + 1px);
  }

  /* Remove padding inside lists */
  > ul {
    padding: 0;
  }
`;
