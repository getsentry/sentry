import {useState} from 'react';
import {IconEllipsis} from '@sentry/icons/iconEllipsis';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {
  fieldAlignment,
  isEquation,
  isEquationAlias,
  isRelativeSpanOperationBreakdownField,
} from 'sentry/utils/discover/fields';
import {getDuration} from 'sentry/utils/duration/getDuration';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

import type {TableColumn} from './types';

export enum Actions {
  ADD = 'add',
  EXCLUDE = 'exclude',
  SHOW_GREATER_THAN = 'show_greater_than',
  SHOW_LESS_THAN = 'show_less_than',
  RELEASE = 'release',
  DRILLDOWN = 'drilldown',
  EDIT_THRESHOLD = 'edit_threshold',
  COPY_TO_CLIPBOARD = 'copy_to_clipboard',
  OPEN_ROW_IN_EXPLORE = 'open_row_in_explore',
  COPY_LINK = 'copy_link',
}

export function updateQuery(
  results: MutableSearch,
  action: Actions,
  column: TableColumn<keyof TableDataRow>,
  value: string | number | string[]
) {
  const key = column.name;

  if (column.type === 'duration' && typeof value === 'number') {
    // values are assumed to be in milliseconds
    value = getDuration(value / 1000, 2, true);
  }

  // De-duplicate array values
  if (Array.isArray(value)) {
    value = [...new Set(value)];
    if (value.length === 1) {
      value = value[0]!;
    }
  }

  switch (action) {
    case Actions.ADD:
      // If the value is null/undefined create a has !has condition.
      if (value === null || value === undefined) {
        // Adding a null value is the same as excluding truthy values.
        // Remove inclusion if it exists.
        results.removeFilterValue('has', key);
        results.addFilterValues('!has', [key]);
      } else {
        addToFilter(results, key, value);
      }
      break;
    case Actions.EXCLUDE:
      if (value === null || value === undefined) {
        // Excluding a null value is the same as including truthy values.
        // Remove exclusion if it exists.
        results.removeFilterValue('!has', key);
        results.addFilterValues('has', [key]);
      } else {
        excludeFromFilter(results, key, value);
      }
      break;
    case Actions.SHOW_GREATER_THAN: {
      // Remove query token if it already exists
      results.setFilterValues(key, [`>${value}`]);
      break;
    }
    case Actions.SHOW_LESS_THAN: {
      // Remove query token if it already exists
      results.setFilterValues(key, [`<${value}`]);
      break;
    }
    // these actions do not modify the query in any way,
    // instead they have side effects
    case Actions.COPY_TO_CLIPBOARD:
      copyToClipboard(value);
      break;
    case Actions.RELEASE:
    case Actions.DRILLDOWN:
      break;
    default:
      throw new Error(`Unknown action type. ${action}`);
  }
}

export function addToFilter(
  oldFilter: MutableSearch,
  key: string,
  value: string | number | string[]
) {
  // Remove exclusion if it exists.
  oldFilter.removeFilter(`!${key}`);

  if (Array.isArray(value)) {
    // For array values, add to existing filters
    const currentFilters = oldFilter.getFilterValues(key);
    value = [...new Set([...currentFilters, ...value])];
  } else {
    value = [String(value)];
  }

  oldFilter.setFilterValues(key, value);
}

export function excludeFromFilter(
  oldFilter: MutableSearch,
  key: string,
  value: string | number | string[]
) {
  // Negations should stack up.
  const negation = `!${key}`;

  value = Array.isArray(value) ? value : [String(value)];
  const currentNegations = oldFilter.getFilterValues(negation);
  oldFilter.removeFilter(negation);

  // We shouldn't escape any of the existing conditions since the
  // existing conditions have already been set an verified by the user
  oldFilter.addFilterValues(
    negation,
    currentNegations.filter(filterValue => !value.includes(filterValue)),
    false
  );

  // Escapes the new condition if necessary
  oldFilter.addFilterValues(negation, value);
}

/**
 * Copies the provided value to a user's clipboard.
 * @param value
 */
export function copyToClipboard(value: string | number | string[]) {
  function stringifyValue(val: string | number | string[]): string {
    if (!val) {
      return '';
    }
    if (typeof val !== 'object') {
      return val.toString();
    }
    return JSON.stringify(val) ?? val.toString();
  }
  navigator.clipboard.writeText(stringifyValue(value)).catch(_ => {
    addErrorMessage('Error copying to clipboard');
  });
}

type CellActionsOpts = {
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  handleCellAction: (action: Actions, value: string | number) => void;
  /**
   * allow list of actions to display on the context menu
   */
  allowActions?: Actions[];
  children?: React.ReactNode;
  /**
   * Caller-provided dropdown items for cell-specific destinations or actions that are
   * not part of the built-in Actions enum. These are appended in addition to the
   * default items filtered by allowActions.
   */
  extraMenuItems?: MenuItemProps[];
};

function makeCellActions({
  dataRow,
  column,
  handleCellAction,
  allowActions,
  extraMenuItems,
}: CellActionsOpts) {
  // Do not render context menu buttons for the span op breakdown field.
  if (isRelativeSpanOperationBreakdownField(column.name)) {
    return null;
  }

  // Do not render context menu buttons for the equation fields until we can query on them
  if (isEquationAlias(column.name) || isEquation(column.key as string)) {
    return null;
  }

  // Starred transaction has it's own action on click
  // so we don't want it to collide with the context menu
  if (column.name === 'is_starred_transaction') {
    return null;
  }

  let value = dataRow[column.key];

  // error.handled is a strange field where null = true.
  if (
    Array.isArray(value) &&
    value[0] === null &&
    column.column.kind === 'field' &&
    column.column.field === 'error.handled'
  ) {
    value = 1;
  }
  const actions: MenuItemProps[] = [];

  function addMenuItem(
    action: Actions,
    itemLabel: React.ReactNode,
    itemTextValue?: string
  ) {
    if ((Array.isArray(allowActions) && allowActions.includes(action)) || !allowActions) {
      actions.push({
        key: action,
        label: itemLabel,
        textValue: itemTextValue,
        onAction: () => handleCellAction(action, value!),
      });
    }
  }

  if (allowActions) {
    addMenuItem(Actions.OPEN_ROW_IN_EXPLORE, t('View span samples'));
  }

  if (value) {
    addMenuItem(Actions.COPY_TO_CLIPBOARD, t('Copy to clipboard'));
  }

  if (allowActions) {
    addMenuItem(Actions.COPY_LINK, t('Copy link'));
  }

  // Array attributes only support an `includes` filter (`attr:[value]`), but the
  // cell action builds an `attr:value` (`is`) filter, which isn't a valid
  // comparison for arrays. Treat `array` like the numeric types here so the
  // add/exclude filter actions are skipped for array values, while a null array
  // field still offers the `!has`/`has` existence filter below.
  if (
    !['duration', 'number', 'percentage', 'array'].includes(column.type) ||
    (value === null && column.column.kind === 'field')
  ) {
    addMenuItem(Actions.ADD, t('Add to filter'));

    if (column.type !== 'date') {
      addMenuItem(Actions.EXCLUDE, t('Exclude from filter'));
    }
  }

  if (
    ['date', 'duration', 'integer', 'number', 'percentage'].includes(column.type) &&
    value !== null
  ) {
    addMenuItem(Actions.SHOW_GREATER_THAN, t('Show values greater than'));

    addMenuItem(Actions.SHOW_LESS_THAN, t('Show values less than'));
  }

  if (column.column.kind === 'field' && column.column.field === 'release' && value) {
    addMenuItem(Actions.RELEASE, t('Go to release'));
  }

  if (column.column.kind === 'function' && column.column.function[0] === 'count_unique') {
    addMenuItem(Actions.DRILLDOWN, t('View Stacks'));
  }

  if (
    column.column.kind === 'function' &&
    column.column.function[0] === 'user_misery' &&
    defined(dataRow.project_threshold_config)
  ) {
    addMenuItem(
      Actions.EDIT_THRESHOLD,
      tct('Edit threshold ([threshold]ms)', {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        threshold: dataRow.project_threshold_config[1],
      }),
      t('Edit threshold')
    );
  }

  if (extraMenuItems) {
    actions.push(...extraMenuItems);
  }

  if (actions.length === 0) {
    return null;
  }

  return actions;
}

type Props = React.PropsWithoutRef<CellActionsOpts> & {
  pin?: React.ReactNode;
  usePortalOnDropdown?: boolean;
};

export function CellAction({pin, allowActions, usePortalOnDropdown, ...props}: Props) {
  const {children, column} = props;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cellActions = makeCellActions({
    ...props,
    allowActions,
  });
  const align = fieldAlignment(column.key as string, column.type);

  return (
    <RevealOnHover
      position="relative"
      width="100%"
      height="100%"
      minWidth="0"
      gap="0"
      data-test-id={cellActions === null ? undefined : 'cell-action-container'}
    >
      <Stack flex="1" minWidth="0" justify="center">
        {children}
        {pin}
      </Stack>
      {!!cellActions?.length && (
        <RevealOnHover.Action visible={isMenuOpen}>
          <Flex position="absolute" top="0" bottom="0" right="0" align="center">
            <DropdownMenu
              items={cellActions}
              usePortal={usePortalOnDropdown}
              disableTextSelection
              strategy="fixed"
              size="sm"
              offset={4}
              position={align === 'left' ? 'bottom-start' : 'bottom-end'}
              preventOverflowOptions={{padding: 4}}
              flipOptions={{
                fallbackPlacements: [
                  'bottom-start',
                  'bottom-end',
                  'top',
                  'right-start',
                  'right-end',
                  'left-start',
                  'left-end',
                ],
              }}
              isOpen={isMenuOpen}
              onOpenChange={setIsMenuOpen}
              trigger={triggerProps => (
                <OverlayTrigger.IconButton
                  {...triggerProps}
                  aria-label={t('Actions')}
                  icon={<IconEllipsis size="xs" />}
                  size="zero"
                />
              )}
              minMenuWidth={0}
            />
          </Flex>
        </RevealOnHover.Action>
      )}
    </RevealOnHover>
  );
}
