import {Component} from 'react';
import {createPortal} from 'react-dom';
import {Manager, Popper, Reference} from 'react-popper';
import styled from '@emotion/styled';
import color from 'color';

import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {
  isEquationAlias,
  isRelativeSpanOperationBreakdownField,
} from 'sentry/utils/discover/fields';
import {getDuration} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {TableColumn} from './types';

export enum Actions {
  ADD = 'add',
  EXCLUDE = 'exclude',
  SHOW_GREATER_THAN = 'show_greater_than',
  SHOW_LESS_THAN = 'show_less_than',
  TRANSACTION = 'transaction',
  RELEASE = 'release',
  DRILLDOWN = 'drilldown',
  EDIT_THRESHOLD = 'edit_threshold',
}

export function updateQuery(
  results: MutableSearch,
  action: Actions,
  column: TableColumn<keyof TableDataRow>,
  value: React.ReactText | string[]
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
      value = value[0];
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
        // Remove exclusion if it exists.
        results.removeFilter(`!${key}`);

        if (Array.isArray(value)) {
          // For array values, add to existing filters
          const currentFilters = results.getFilterValues(key);
          value = [...new Set([...currentFilters, ...value])];
        } else {
          value = [String(value)];
        }

        results.setFilterValues(key, value);
      }
      break;
    case Actions.EXCLUDE:
      if (value === null || value === undefined) {
        // Excluding a null value is the same as including truthy values.
        // Remove exclusion if it exists.
        results.removeFilterValue('!has', key);
        results.addFilterValues('has', [key]);
      } else {
        // Remove positive if it exists.
        results.removeFilter(key);
        // Negations should stack up.
        const negation = `!${key}`;
        value = Array.isArray(value) ? value : [String(value)];
        const currentNegations = results.getFilterValues(negation);
        results.removeFilter(negation);
        // We shouldn't escape any of the existing conditions since the
        // existing conditions have already been set an verified by the user
        results.addFilterValues(
          negation,
          currentNegations.filter(
            filterValue => !(value as string[]).includes(filterValue)
          ),
          false
        );
        // Escapes the new condition if necessary
        results.addFilterValues(negation, value);
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
    case Actions.TRANSACTION:
    case Actions.RELEASE:
    case Actions.DRILLDOWN:
      break;
    default:
      throw new Error(`Unknown action type. ${action}`);
  }
}

type CellActionsOpts = {
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  handleCellAction: (action: Actions, value: React.ReactText) => void;
  /**
   * allow list of actions to display on the context menu
   */
  allowActions?: Actions[];
};

function makeCellActions({
  dataRow,
  column,
  handleCellAction,
  allowActions,
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
  const actions: React.ReactNode[] = [];

  function addMenuItem(action: Actions, menuItem: React.ReactNode) {
    if ((Array.isArray(allowActions) && allowActions.includes(action)) || !allowActions) {
      actions.push(menuItem);
    }
  }

  if (
    !['duration', 'number', 'percentage'].includes(column.type) ||
    (value === null && column.column.kind === 'field')
  ) {
    addMenuItem(
      Actions.ADD,
      <ActionItem
        key="add-to-filter"
        data-test-id="add-to-filter"
        onClick={() => handleCellAction(Actions.ADD, value)}
      >
        {t('Add to filter')}
      </ActionItem>
    );

    if (column.type !== 'date') {
      addMenuItem(
        Actions.EXCLUDE,
        <ActionItem
          key="exclude-from-filter"
          data-test-id="exclude-from-filter"
          onClick={() => handleCellAction(Actions.EXCLUDE, value)}
        >
          {t('Exclude from filter')}
        </ActionItem>
      );
    }
  }

  if (
    ['date', 'duration', 'integer', 'number', 'percentage'].includes(column.type) &&
    value !== null
  ) {
    addMenuItem(
      Actions.SHOW_GREATER_THAN,
      <ActionItem
        key="show-values-greater-than"
        data-test-id="show-values-greater-than"
        onClick={() => handleCellAction(Actions.SHOW_GREATER_THAN, value)}
      >
        {t('Show values greater than')}
      </ActionItem>
    );

    addMenuItem(
      Actions.SHOW_LESS_THAN,
      <ActionItem
        key="show-values-less-than"
        data-test-id="show-values-less-than"
        onClick={() => handleCellAction(Actions.SHOW_LESS_THAN, value)}
      >
        {t('Show values less than')}
      </ActionItem>
    );
  }

  if (column.column.kind === 'field' && column.column.field === 'transaction') {
    addMenuItem(
      Actions.TRANSACTION,
      <ActionItem
        key="transaction-summary"
        data-test-id="transaction-summary"
        onClick={() => handleCellAction(Actions.TRANSACTION, value)}
      >
        {t('Go to summary')}
      </ActionItem>
    );
  }

  if (column.column.kind === 'field' && column.column.field === 'release' && value) {
    addMenuItem(
      Actions.RELEASE,
      <ActionItem
        key="release"
        data-test-id="release"
        onClick={() => handleCellAction(Actions.RELEASE, value)}
      >
        {t('Go to release')}
      </ActionItem>
    );
  }

  if (column.column.kind === 'function' && column.column.function[0] === 'count_unique') {
    addMenuItem(
      Actions.DRILLDOWN,
      <ActionItem
        key="drilldown"
        data-test-id="per-cell-drilldown"
        onClick={() => handleCellAction(Actions.DRILLDOWN, value)}
      >
        {t('View Stacks')}
      </ActionItem>
    );
  }

  if (
    column.column.kind === 'function' &&
    column.column.function[0] === 'user_misery' &&
    defined(dataRow.project_threshold_config)
  ) {
    addMenuItem(
      Actions.EDIT_THRESHOLD,
      <ActionItem
        key="edit_threshold"
        data-test-id="edit-threshold"
        onClick={() => handleCellAction(Actions.EDIT_THRESHOLD, value)}
      >
        {tct('Edit threshold ([threshold]ms)', {
          threshold: dataRow.project_threshold_config[1],
        })}
      </ActionItem>
    );
  }

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
  constructor(props: Props) {
    super(props);
    let portal = document.getElementById('cell-action-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.setAttribute('id', 'cell-action-portal');
      document.body.appendChild(portal);
    }
    this.portalEl = portal;
    this.menuEl = null;
  }

  state: State = {
    isHovering: false,
    isOpen: false,
  };

  componentDidUpdate(_props: Props, prevState: State) {
    if (this.state.isOpen && prevState.isOpen === false) {
      document.addEventListener('click', this.handleClickOutside, true);
    }
    if (this.state.isOpen === false && prevState.isOpen) {
      document.removeEventListener('click', this.handleClickOutside, true);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside, true);
  }

  private portalEl: Element;
  private menuEl: Element | null;

  handleClickOutside = (event: MouseEvent) => {
    if (!this.menuEl) {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    if (this.menuEl.contains(event.target)) {
      return;
    }
    this.setState({isOpen: false, isHovering: false});
  };

  handleMouseEnter = () => {
    this.setState({isHovering: true});
  };

  handleMouseLeave = () => {
    this.setState(state => {
      // Don't hide the button if the menu is open.
      if (state.isOpen) {
        return state;
      }
      return {...state, isHovering: false};
    });
  };

  handleMenuToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    this.setState({isOpen: !this.state.isOpen});
  };

  renderMenu() {
    const {isOpen} = this.state;

    const actions = makeCellActions(this.props);

    if (actions === null) {
      // do not render the menu if there are no per cell actions
      return null;
    }

    const modifiers = [
      {
        name: 'hide',
        enabled: false,
      },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          padding: 10,
          altAxis: true,
        },
      },
      {
        name: 'offset',
        options: {
          offset: [0, ARROW_SIZE / 2],
        },
      },
      {
        name: 'computeStyles',
        options: {
          // Using the `transform` attribute causes our borders to get blurry
          // in chrome. See [0]. This just causes it to use `top` / `left`
          // positions, which should be fine.
          //
          // [0]: https://stackoverflow.com/questions/29543142/css3-transformation-blurry-borders
          gpuAcceleration: false,
        },
      },
    ];

    const menu = !isOpen
      ? null
      : createPortal(
          <Popper placement="top" modifiers={modifiers}>
            {({ref: popperRef, style, placement, arrowProps}) => (
              <Menu
                ref={ref => {
                  (popperRef as Function)(ref);
                  this.menuEl = ref;
                }}
                style={style}
              >
                <MenuArrow
                  ref={arrowProps.ref}
                  data-placement={placement}
                  style={arrowProps.style}
                />
                <MenuButtons onClick={event => event.stopPropagation()}>
                  {actions}
                </MenuButtons>
              </Menu>
            )}
          </Popper>,
          this.portalEl
        );

    return (
      <MenuRoot>
        <Manager>
          <Reference>
            {({ref}) => (
              <MenuButton ref={ref} onClick={this.handleMenuToggle}>
                <IconEllipsis size="sm" data-test-id="cell-action" color="linkColor" />
              </MenuButton>
            )}
          </Reference>
          {menu}
        </Manager>
      </MenuRoot>
    );
  }

  render() {
    const {children} = this.props;
    const {isHovering} = this.state;

    return (
      <Container
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        data-test-id="cell-action-container"
      >
        {children}
        {isHovering && this.renderMenu()}
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

const MenuRoot = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
`;

const Menu = styled('div')`
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const MenuButtons = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  overflow: hidden;
`;

const ARROW_SIZE = 12;

const MenuArrow = styled('span')`
  pointer-events: none;
  position: absolute;
  width: ${ARROW_SIZE}px;
  height: ${ARROW_SIZE}px;

  &::before,
  &::after {
    content: '';
    display: block;
    position: absolute;
    height: ${ARROW_SIZE}px;
    width: ${ARROW_SIZE}px;
    border: solid 6px transparent;
  }

  &[data-placement|='bottom'] {
    top: -${ARROW_SIZE}px;
    &::before {
      bottom: 1px;
      border-bottom-color: ${p => p.theme.translucentBorder};
    }
    &::after {
      border-bottom-color: ${p => p.theme.backgroundElevated};
    }
  }

  &[data-placement|='top'] {
    bottom: -${ARROW_SIZE}px;
    &::before {
      top: 1px;
      border-top-color: ${p => p.theme.translucentBorder};
    }
    &::after {
      border-top-color: ${p => p.theme.backgroundElevated};
    }
  }

  &[data-placement|='right'] {
    left: -${ARROW_SIZE}px;
    &::before {
      right: 1px;
      border-right-color: ${p => p.theme.translucentBorder};
    }
    &::after {
      border-right-color: ${p => p.theme.backgroundElevated};
    }
  }

  &[data-placement|='left'] {
    right: -${ARROW_SIZE}px;
    &::before {
      left: 1px;
      border-left-color: ${p => p.theme.translucentBorder};
    }
    &::after {
      border-left-color: ${p => p.theme.backgroundElevated};
    }
  }
`;

const ActionItem = styled('button')`
  display: block;
  width: 100%;
  padding: ${space(1)} ${space(2)};
  background: transparent;

  outline: none;
  border: 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  font-size: ${p => p.theme.fontSizeMedium};
  text-align: left;
  line-height: 1.2;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }

  &:last-child {
    border-bottom: 0;
  }
`;

const MenuButton = styled('button')`
  display: flex;
  width: 24px;
  height: 24px;
  padding: 0;
  justify-content: center;
  align-items: center;

  background: ${p => color(p.theme.background).alpha(0.85).string()};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  cursor: pointer;
  outline: none;
`;
