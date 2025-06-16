import React, {Component} from 'react';
import styled from '@emotion/styled';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {
  isEquationAlias,
  isRelativeSpanOperationBreakdownField,
} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
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
  COPY_TEXT = 'copy_text',
  OPEN_URL = 'open_url',
}

function stringify(value: string | number | string[] | undefined) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.toString();
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
    case Actions.COPY_TEXT:
      navigator.clipboard.writeText(stringify(value));
      break;
    case Actions.OPEN_URL:
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

type CellActionsOpts = {
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  handleCellAction: (action: Actions, value: string | number) => void;
  /**
   * allow list of actions to display on the context menu
   */
  allowActions?: Actions[];
  children?: React.ReactNode;
  hasUrl?: boolean;
  openUrlInNewTab?: boolean;
};

function makeCellActions({
  dataRow,
  column,
  handleCellAction,
  allowActions,
  hasUrl,
  openUrlInNewTab = false,
}: CellActionsOpts) {
  // Do not render context menu buttons for the span op breakdown field.
  if (isRelativeSpanOperationBreakdownField(column.name)) {
    return null;
  }

  // Do not render context menu buttons for the equation fields until we can query on them
  if (isEquationAlias(column.name)) {
    return null;
  }

  let value = dataRow[column.name];

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

  if (
    !['duration', 'number', 'percentage'].includes(column.type) ||
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

  if (hasUrl && !openUrlInNewTab) {
    addMenuItem(Actions.OPEN_URL, t('Open url'));
  }

  if (hasUrl && openUrlInNewTab) {
    addMenuItem(Actions.OPEN_URL, t('Open url in new tab'));
  }

  addMenuItem(Actions.COPY_TEXT, t('Copy text'));

  if (actions.length === 0) {
    return null;
  }

  return actions;
}

type Props = React.PropsWithoutRef<CellActionsOpts>;

type State = {
  isHovering: boolean;
  isOpen: boolean;
};

class CellAction extends Component<Props, State> {
  render() {
    const {children, dataRow, column} = this.props;
    const cellActions = makeCellActions(this.props);

    const rowText = stringify(dataRow[column.key]);

    return (
      <Container
        data-test-id={cellActions === null ? undefined : 'cell-action-container'}
      >
        {cellActions?.length && (
          <DropdownMenu
            items={cellActions}
            usePortal
            size="sm"
            offset={4}
            position="bottom"
            preventOverflowOptions={{mainAxis: false}}
            flipOptions={{
              fallbackPlacements: [
                'top',
                'right-start',
                'right-end',
                'left-start',
                'left-end',
              ],
            }}
            trigger={triggerProps => (
              <div style={{display: 'block'}}>
                <TriggerWrapper {...triggerProps} text={rowText}>
                  {children}
                </TriggerWrapper>
              </div>
            )}
          />
        )}
      </Container>
    );
  }
}

export default CellAction;

const Container = styled('div')`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const TriggerWrapper = styled('div')<{text?: string}>`
  :hover {
    cursor: pointer;
    text-shadow: 0.5px 0 0 currentColor;
  }
  margin: -${space(1)} -${space(2)};
  padding: ${space(1)} ${space(2)};
`;
