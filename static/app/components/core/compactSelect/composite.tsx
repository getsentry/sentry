import {Children, isValidElement, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {Item} from '@react-stately/collections';
import type {DistributedOmit} from 'type-fest';

import {type ButtonProps} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

import {ClearButton, Control, ControlContext} from './control';
import type {ControlProps} from './control';
import type {MultipleListProps, SingleListProps} from './list';
import {List} from './list';
import {EmptyMessage} from './styles';
import type {SelectKey, SelectOption} from './types';
import {
  getDisabledOptions,
  getHiddenOptions,
  getItemsWithKeys,
  getSortedItems,
} from './utils';

interface BaseCompositeSelectRegion<Value extends SelectKey> {
  options: Array<SelectOption<Value>>;
  key?: SelectKey;
  label?: React.ReactNode;
}

/**
 * A single-selection (only one option can be selected at a time) "region" inside a
 * composite select. Each "region" is a separated, self-contained selectable list (each
 * renders as a `ul` with its own list state) whose selection values don't interfere
 * with one another.
 */
type SingleCompositeSelectRegion<Value extends SelectKey> =
  BaseCompositeSelectRegion<Value> &
    DistributedOmit<
      SingleListProps<Value>,
      'children' | 'items' | 'grid' | 'size' | 'autoHighlightFirstResult'
    >;

/**
 * A multiple-selection (multiple options can be selected at the same time) "region"
 * inside a composite select. Each "region" is a separated, self-contained selectable
 * list (each renders as a `ul` with its own list state) whose selection values don't
 * interfere with one another.
 */
type MultipleCompositeSelectRegion<Value extends SelectKey> =
  BaseCompositeSelectRegion<Value> &
    DistributedOmit<
      MultipleListProps<Value>,
      'children' | 'items' | 'grid' | 'size' | 'autoHighlightFirstResult'
    >;

/**
 * A "region" inside a composite select. Each "region" is a separated, self-contained
 * selectable list (each renders as a `ul` with its own list state) whose selection
 * values don't interfere with one another.
 */
type CompositeSelectRegion<Value extends SelectKey> =
  | SingleCompositeSelectRegion<Value>
  | MultipleCompositeSelectRegion<Value>;

/**
 * A React child inside CompositeSelect. This helps ensure that the only non-falsy child
 * allowed inside CompositeSelect is CompositeSelect.Region
 */
type CompositeSelectChild =
  | React.ReactElement<CompositeSelectRegion<SelectKey>>
  | false
  | null
  | undefined;

export interface CompositeSelectProps extends Omit<
  ControlProps,
  'clearable' | 'triggerProps' | 'trigger'
> {
  /**
   * The "regions" inside this composite selector. Each region functions as a separated,
   * self-contained selectable list (each renders as a `ul` with its own list state)
   * whose values don't interfere with one another.
   */
  children: CompositeSelectChild | CompositeSelectChild[];
  trigger: NonNullable<ControlProps['trigger']>;
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
  ...controlProps
}: CompositeSelectProps) {
  return (
    <Control {...controlProps} grid={grid} size={size} disabled={disabled}>
      <CompositeRegions grid={grid} size={size} emptyMessage={emptyMessage}>
        {children}
      </CompositeRegions>
    </Control>
  );
}

type CompositeRegionsProps = Pick<CompositeSelectProps, 'children' | 'emptyMessage'> & {
  grid: CompositeSelectProps['grid'];
  size: NonNullable<CompositeSelectProps['size']>;
};

function CompositeRegions({children, grid, size, emptyMessage}: CompositeRegionsProps) {
  const {highlightFirstResult, overlayIsOpen, search, searchMatcher} =
    useContext(ControlContext);

  const regionChildren = useMemo(
    () =>
      Children.toArray(children).filter(
        (child): child is React.ReactElement<CompositeSelectRegion<SelectKey>> =>
          isValidElement<CompositeSelectRegion<SelectKey>>(child)
      ),
    [children]
  );

  const autoHighlightedRegionIndex = useMemo(() => {
    if (!highlightFirstResult || !overlayIsOpen || search.trim().length === 0) {
      return -1;
    }

    return regionChildren.findIndex(
      child => getFirstFocusableOptionKey(child.props, search, searchMatcher) !== null
    );
  }, [highlightFirstResult, overlayIsOpen, regionChildren, search, searchMatcher]);

  return (
    <FocusScope>
      <RegionsWrap>
        {regionChildren.map((child, index) => (
          <Region
            {...child.props}
            key={child.key ?? undefined}
            grid={grid}
            size={size}
            autoHighlightFirstResult={index === autoHighlightedRegionIndex}
          />
        ))}

        {/* Only displayed when all lists (regions) are empty */}
        <EmptyMessage>{emptyMessage ?? t('No options found')}</EmptyMessage>
      </RegionsWrap>
    </FocusScope>
  );
}

/**
 * A "region" inside composite selectors. Each "region" is a separated, self-contained
 * selectable list (each renders as a `ul` with its own list state) whose selection
 * values don't interfere with one another.
 */
CompositeSelect.Region = function <Value extends SelectKey>(
  _props: CompositeSelectRegion<Value>
) {
  // This pseudo-component not meant to be rendered. It only functions as a props vessel
  // and composable child to `CompositeSelect`. `CompositeSelect` iterates over all child
  // instances of `CompositeSelect.Region` and renders `Region` with the specified props.
  return null;
};

CompositeSelect.ClearButton = function CompositeSelectClearButton(
  props: DistributedOmit<ButtonProps, 'variant' | 'size' | 'children'>
) {
  return (
    <ClearButton size="zero" variant="transparent" {...props}>
      {t('Clear')}
    </ClearButton>
  );
};

export {CompositeSelect};

type RegionProps<Value extends SelectKey> = CompositeSelectRegion<Value> & {
  autoHighlightFirstResult: NonNullable<
    SingleListProps<Value>['autoHighlightFirstResult']
  >;
  grid: SingleListProps<Value>['grid'];
  size: SingleListProps<Value>['size'];
};

function Region<Value extends SelectKey>({
  options,
  isOptionDisabled,
  size,
  label,
  autoHighlightFirstResult,
  ...props
}: RegionProps<Value>) {
  const itemsWithKey = useMemo(() => getItemsWithKeys(options), [options]);

  return (
    <List
      {...props}
      items={itemsWithKey}
      isOptionDisabled={isOptionDisabled}
      shouldFocusWrap={false}
      size={size}
      label={label}
      autoHighlightFirstResult={autoHighlightFirstResult}
    >
      {(opt: (typeof itemsWithKey)[number]) => (
        <Item {...opt} key={opt.key}>
          {opt.label}
        </Item>
      )}
    </List>
  );
}

function getFirstFocusableOptionKey<Value extends SelectKey>(
  {options, isOptionDisabled, sizeLimit}: CompositeSelectRegion<Value>,
  search: string,
  searchMatcher: React.ContextType<typeof ControlContext>['searchMatcher']
) {
  const itemsWithKey = getItemsWithKeys(options);
  const {hidden: hiddenOptions, scores} = getHiddenOptions(
    itemsWithKey,
    search,
    sizeLimit,
    searchMatcher
  );
  const sortedItems =
    scores.size > 0 ? getSortedItems(itemsWithKey, scores) : itemsWithKey;
  const disabledKeys = new Set([
    ...hiddenOptions,
    ...getDisabledOptions(itemsWithKey, isOptionDisabled),
  ]);

  return sortedItems.find(item => !disabledKeys.has(item.key))?.key ?? null;
}

const RegionsWrap = styled('div')`
  min-height: 0;
  overflow: auto;
  padding: ${p => p.theme.space.xs} 0;

  /* Add 1px to top padding if preceded by menu header, to account for the header's
  shadow border */
  [data-menu-has-header='true'] > div > & {
    padding-top: calc(${p => p.theme.space.xs} + 1px);
  }

  /* Add 1px to bottom padding if succeeded by menu footer, to account for the footer's
  shadow border */
  [data-menu-has-footer='true'] > div > & {
    padding-bottom: calc(${p => p.theme.space.xs} + 1px);
  }

  /* Remove padding inside lists */
  > ul {
    padding: 0;
  }
`;
