import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {
  fieldAlignment,
  isEquationAlias,
  isRelativeSpanOperationBreakdownField,
} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
import {FieldKey} from 'sentry/utils/fields';
import {isUrl} from 'sentry/utils/string/isUrl';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import stripURLOrigin from 'sentry/utils/url/stripURLOrigin';
import useOrganization from 'sentry/utils/useOrganization';

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
  OPEN_EXTERNAL_LINK = 'open_external_link',
  OPEN_INTERNAL_LINK = 'open_internal_link',
  OPEN_ROW_IN_EXPLORE = 'open_row_in_explore',
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
    case Actions.OPEN_EXTERNAL_LINK:
    case Actions.RELEASE:
    case Actions.DRILLDOWN:
    case Actions.OPEN_INTERNAL_LINK:
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
    if (!val) return '';
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
   * Any parsed out internal links that should be added to the menu as an option
   */
  to?: string;
};

function makeCellActions({
  dataRow,
  column,
  handleCellAction,
  allowActions,
  to,
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
        to: action === Actions.OPEN_INTERNAL_LINK && to ? stripURLOrigin(to) : undefined,
        externalHref:
          action === Actions.OPEN_EXTERNAL_LINK ? (value as string) : undefined,
      });
    }
  }

  if (to && to !== value) {
    const field = String(column.key);
    addMenuItem(Actions.OPEN_INTERNAL_LINK, getInternalLinkActionLabel(field));
  }

  if (isUrl(value)) {
    addMenuItem(Actions.OPEN_EXTERNAL_LINK, t('Open external link'));
  }

  if (allowActions) {
    addMenuItem(Actions.OPEN_ROW_IN_EXPLORE, t('View span samples'));
  }

  if (value) addMenuItem(Actions.COPY_TO_CLIPBOARD, t('Copy to clipboard'));

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

  if (actions.length === 0) {
    return null;
  }

  return actions;
}

/**
 * Provides the correct text for the dropdown menu based on the field.
 * @param field column field name
 */
function getInternalLinkActionLabel(field: string): string {
  switch (field) {
    case FieldKey.TRACE:
      return t('Open trace');
    case FieldKey.PROJECT:
    case 'project_id':
    case 'project.id':
      return t('Open project');
    case FieldKey.RELEASE:
      return t('View details');
    case FieldKey.ISSUE:
      return t('Open issue');
    case FieldKey.REPLAY_ID:
      return t('Open replay');
    default:
      break;
  }
  return t('Open link');
}

/**
 * Potentially temporary as design and product need more time to determine how logs table should trigger the dropdown.
 * Currently, the agreed default for every table should be bold hover. Logs is the only table to use the ellipsis trigger.
 */
export enum ActionTriggerType {
  ELLIPSIS = 'ellipsis',
  BOLD_HOVER = 'bold_hover',
}

type Props = React.PropsWithoutRef<Omit<CellActionsOpts, 'to'>> & {
  triggerType?: ActionTriggerType;
  usePortalOnDropdown?: boolean;
};

function CellAction({
  triggerType = ActionTriggerType.BOLD_HOVER,
  allowActions,
  usePortalOnDropdown,
  ...props
}: Props) {
  const organization = useOrganization();
  const {children, column} = props;
  // The menu is activated by clicking the value, which doesn't work if the value is rendered as a link
  // So, `target` contains an internal link extracted from the DOM on click and that link is added dropdown menu.
  const [target, setTarget] = useState<string>();

  const useCellActionsV2 = organization.features.includes('discover-cell-actions-v2');
  let filteredActions = allowActions;
  if (!useCellActionsV2 && filteredActions) {
    // New dropdown menu options should not be allowed if the feature flag is not on
    filteredActions = filteredActions.filter(
      action =>
        action !== Actions.OPEN_EXTERNAL_LINK && action !== Actions.OPEN_INTERNAL_LINK
    );
  }
  const cellActions = makeCellActions({
    ...props,
    allowActions: filteredActions,
    to: target,
  });
  const align = fieldAlignment(column.key as string, column.type);

  if (useCellActionsV2 && triggerType === ActionTriggerType.BOLD_HOVER) {
    return (
      <Container
        data-test-id={cellActions === null ? undefined : 'cell-action-container'}
      >
        {cellActions?.length ? (
          <DropdownMenu
            usePortal={usePortalOnDropdown}
            items={cellActions}
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
            trigger={triggerProps => (
              <ActionMenuTriggerV2
                {...triggerProps}
                aria-label={t('Actions')}
                onClickCapture={e => {
                  // Allow for users to hold shift, ctrl or cmd to open links instead of the menu
                  if (e.metaKey || e.shiftKey || e.ctrlKey) {
                    e.stopPropagation();
                  } else {
                    const aTags = e.currentTarget.getElementsByTagName('a');
                    if (aTags?.[0]) {
                      const href = aTags[0].href;
                      setTarget(href);
                    }
                    e.preventDefault();
                  }
                }}
                hasLinks={
                  // TODO - hack, ideally we don't directly access the DOM and use a ref instead, ideally we can determin if the cell type has a link
                  !!document
                    .getElementById(triggerProps.id ?? '')
                    ?.getElementsByTagName('a')?.[0]
                }
              >
                {children}
              </ActionMenuTriggerV2>
            )}
            minMenuWidth={0}
          />
        ) : (
          children
        )}
      </Container>
    );
  }

  return (
    <Container data-test-id={cellActions === null ? undefined : 'cell-action-container'}>
      {children}
      {cellActions?.length && (
        <DropdownMenu
          items={cellActions}
          usePortal
          size="sm"
          offset={4}
          position="bottom"
          preventOverflowOptions={{padding: 4}}
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
            <ActionMenuTrigger
              {...triggerProps}
              translucentBorder
              aria-label={t('Actions')}
              icon={<IconEllipsis size="xs" />}
              size="zero"
            />
          )}
        />
      )}
    </Container>
  );
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

const ActionMenuTrigger = styled(Button)`
  position: absolute;
  top: 50%;
  right: -1px;
  transform: translateY(-50%);
  padding: ${p => p.theme.space.xs};

  display: flex;
  align-items: center;

  opacity: 0;
  transition: opacity 0.1s;
  &:focus-visible,
  &[aria-expanded='true'],
  ${Container}:hover & {
    opacity: 1;
  }
`;

const ActionMenuTriggerV2 = styled('div')<{hasLinks?: boolean}>`
  a,
  span {
    color: ${p => (p.hasLinks ? p.theme.linkColor : p.theme.tokens.content.primary)};
  }
  :hover {
    cursor: pointer;
    text-shadow: 0.5px 0px;
  }
`;
