import React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';
import * as PopperJS from 'popper.js';
import {Manager, Reference, Popper} from 'react-popper';

import {t} from 'app/locale';
import {IconEllipsis} from 'app/icons';
import space from 'app/styles/space';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import {QueryResults} from 'app/utils/tokenizeSearch';

import {TableColumn} from './types';

export enum Actions {
  ADD = 'add',
  EXCLUDE = 'exclude',
  SHOW_GREATER_THAN = 'show_greater_than',
  SHOW_LESS_THAN = 'show_less_than',
  TRANSACTION = 'transaction',
  RELEASE = 'release',
  DRILLDOWN = 'drilldown',
}

export function updateQuery(
  results: QueryResults,
  action: Actions,
  key: string,
  value: React.ReactText
) {
  switch (action) {
    case Actions.ADD:
      // If the value is null/undefined create a has !has condition.
      if (value === null || value === undefined) {
        // Adding a null value is the same as excluding truthy values.
        // Remove inclusion if it exists.
        results.removeTagValue('has', key);
        results.addTagValues('!has', [key]);
      } else {
        // Remove exclusion if it exists.
        results.removeTag(`!${key}`).setTagValues(key, [`${value}`]);
      }
      break;
    case Actions.EXCLUDE:
      if (value === null || value === undefined) {
        // Excluding a null value is the same as including truthy values.
        // Remove exclusion if it exists.
        results.removeTagValue('!has', key);
        results.addTagValues('has', [key]);
      } else {
        // Remove positive if it exists.
        results.removeTag(key);
        // Negations should stack up.
        const negation = `!${key}`;
        results.addTagValues(negation, [`${value}`]);
      }
      break;
    case Actions.SHOW_GREATER_THAN: {
      // Remove query token if it already exists
      results.setTagValues(key, [`>${value}`]);
      break;
    }
    case Actions.SHOW_LESS_THAN: {
      // Remove query token if it already exists
      results.setTagValues(key, [`<${value}`]);
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

type Props = {
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  children: React.ReactNode;
  handleCellAction: (action: Actions, value: React.ReactText) => void;

  // allow list of actions to display on the context menu
  allowActions?: Actions[];
};

type State = {
  isHovering: boolean;
  isOpen: boolean;
};

class CellAction extends React.Component<Props, State> {
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

  state = {
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

  renderMenuButtons() {
    const {dataRow, column, handleCellAction, allowActions} = this.props;
    const fieldAlias = getAggregateAlias(column.name);

    // Slice out the last element from array values as that is the value
    // we show. See utils/discover/fieldRenderers.tsx and how
    // strings and error.handled are rendered.
    let value = dataRow[fieldAlias];
    if (Array.isArray(value)) {
      value = value.slice(-1)[0];
    }

    // error.handled is a strange field where null = true.
    if (
      value === null &&
      column.column.kind === 'field' &&
      column.column.field === 'error.handled'
    ) {
      value = 1;
    }
    const actions: React.ReactNode[] = [];

    function addMenuItem(action: Actions, menuItem: React.ReactNode) {
      if (
        (Array.isArray(allowActions) && allowActions.includes(action)) ||
        !allowActions
      ) {
        actions.push(menuItem);
      }
    }

    if (
      !['duration', 'number', 'percentage'].includes(column.type) ||
      (value === null &&
        column.column.kind === 'field' &&
        column.column.field !== 'error.handled')
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

    if (
      column.column.kind === 'function' &&
      column.column.function[0] === 'count_unique'
    ) {
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

    if (actions.length === 0) {
      return null;
    }

    return (
      <MenuButtons
        onClick={event => {
          // prevent clicks from propagating further
          event.stopPropagation();
        }}
      >
        {actions}
      </MenuButtons>
    );
  }

  renderMenu() {
    const {isOpen} = this.state;

    const menuButtons = this.renderMenuButtons();

    if (menuButtons === null) {
      // do not render the menu if there are no per cell actions
      return null;
    }

    const modifiers: PopperJS.Modifiers = {
      hide: {
        enabled: false,
      },
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
    };
    let menu: React.ReactPortal | null = null;

    if (isOpen) {
      menu = ReactDOM.createPortal(
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
              {menuButtons}
            </Menu>
          )}
        </Popper>,
        this.portalEl
      );
    }

    return (
      <MenuRoot>
        <Manager>
          <Reference>
            {({ref}) => (
              <MenuButton ref={ref} onClick={this.handleMenuToggle}>
                <IconEllipsis size="sm" data-test-id="cell-action" color="blue400" />
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
`;

const MenuRoot = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
`;

const Menu = styled('div')`
  margin: ${space(1)} 0;

  z-index: ${p => p.theme.zIndex.tooltip};
`;

const MenuButtons = styled('div')`
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  overflow: hidden;
`;

const MenuArrow = styled('span')`
  position: absolute;
  width: 18px;
  height: 9px;
  /* left and top set by popper */

  &[data-placement*='bottom'] {
    margin-top: -9px;
    &::before {
      border-width: 0 9px 9px 9px;
      border-color: transparent transparent ${p => p.theme.borderLight} transparent;
    }
    &::after {
      top: 1px;
      left: 1px;
      border-width: 0 8px 8px 8px;
      border-color: transparent transparent #fff transparent;
    }
  }
  &[data-placement*='top'] {
    margin-bottom: -8px;
    bottom: 0;
    &::before {
      border-width: 9px 9px 0 9px;
      border-color: ${p => p.theme.borderLight} transparent transparent transparent;
    }
    &::after {
      bottom: 1px;
      left: 1px;
      border-width: 8px 8px 0 8px;
      border-color: #fff transparent transparent transparent;
    }
  }

  &::before,
  &::after {
    width: 0;
    height: 0;
    content: '';
    display: block;
    position: absolute;
    border-style: solid;
  }
`;

const ActionItem = styled('button')`
  display: block;
  width: 100%;
  padding: ${space(1)} ${space(2)};
  background: transparent;

  outline: none;
  border: 0;
  border-bottom: 1px solid ${p => p.theme.borderLight};

  font-size: ${p => p.theme.fontSizeMedium};
  text-align: left;
  line-height: 1.2;

  &:hover {
    background: ${p => p.theme.gray100};
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

  background: rgba(255, 255, 255, 0.85);
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.borderLight};
  cursor: pointer;
  outline: none;
`;
