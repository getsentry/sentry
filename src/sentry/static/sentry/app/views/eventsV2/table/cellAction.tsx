import React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';
import * as PopperJS from 'popper.js';
import {Manager, Reference, Popper} from 'react-popper';

import {t} from 'app/locale';
import {defined} from 'app/utils';
import {IconEllipsis} from 'app/icons';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import space from 'app/styles/space';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {OrganizationSummary, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import withProjects from 'app/utils/withProjects';

import {TableColumn, TableDataRow} from './types';

export enum Actions {
  ADD = 'add',
  EXCLUDE = 'exclude',
  SHOW_GREATER_THAN = 'show_greater_than',
  SHOW_LESS_THAN = 'show_less_than',
  TRANSACTION = 'transaction',
  RELEASE = 'release',
}

type Props = {
  eventView: EventView;
  organization: OrganizationSummary;
  projects: Project[];
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  tableMeta: MetaType;
  children: React.ReactNode;
  handleCellAction: (action: Actions, value: React.ReactText) => void;
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

  handleCellAction = (action: Actions, value: React.ReactText) => {
    const {eventView, column, organization, tableMeta, projects, dataRow} = this.props;

    const query = tokenizeSearch(eventView.query);

    let nextView = eventView.clone();

    trackAnalyticsEvent({
      eventKey: 'discover_v2.results.cellaction',
      eventName: 'Discoverv2: Cell Action Clicked',
      organization_id: parseInt(organization.id, 10),
      action,
    });

    switch (action) {
      case Actions.ADD:
        // Remove exclusion if it exists.
        delete query[`!${column.name}`];
        query[column.name] = [`${value}`];
        break;
      case Actions.EXCLUDE:
        // Remove positive if it exists.
        delete query[column.name];
        // Negations should stack up.
        const negation = `!${column.name}`;
        if (!query.hasOwnProperty(negation)) {
          query[negation] = [];
        }
        query[negation].push(`${value}`);
        break;
      case Actions.SHOW_GREATER_THAN: {
        // Remove query token if it already exists
        delete query[column.name];
        query[column.name] = [`>${value}`];
        const field = {field: column.name, width: column.width};

        // sort descending order
        nextView = nextView.sortOnField(field, tableMeta, 'desc');

        break;
      }
      case Actions.SHOW_LESS_THAN: {
        // Remove query token if it already exists
        delete query[column.name];
        query[column.name] = [`<${value}`];
        const field = {field: column.name, width: column.width};

        // sort ascending order
        nextView = nextView.sortOnField(field, tableMeta, 'asc');

        break;
      }
      case Actions.TRANSACTION: {
        const maybeProject = projects.find(project => project.slug === dataRow.project);

        const projectID = maybeProject ? [maybeProject.id] : undefined;

        const next = transactionSummaryRouteWithQuery({
          orgSlug: organization.slug,
          transaction: String(value),
          projectID,
          query: {},
        });

        browserHistory.push(next);
        return;
      }
      case Actions.RELEASE: {
        const maybeProject = projects.find(project => {
          return project.slug === dataRow.project;
        });

        browserHistory.push({
          pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(
            value
          )}/`,
          query: {
            ...nextView.getGlobalSelection(),

            project: maybeProject ? maybeProject.id : undefined,
          },
        });

        return;
      }
      default:
        throw new Error(`Unknown action type. ${action}`);
    }
    nextView.query = stringifyQueryObject(query);

    browserHistory.push(nextView.getResultsViewUrlTarget(organization.slug));
  };

  handleMenuToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    this.setState({isOpen: !this.state.isOpen});
  };

  renderMenuButtons() {
    const {dataRow, column} = this.props;

    const fieldAlias = getAggregateAlias(column.name);
    const value = dataRow[fieldAlias];

    const actions: React.ReactNode[] = [];

    if (column.type !== 'duration') {
      actions.push(
        <ActionItem
          key="add-to-filter"
          data-test-id="add-to-filter"
          onClick={() => this.handleCellAction(Actions.ADD, value)}
        >
          {t('Add to filter')}
        </ActionItem>
      );

      actions.push(
        <ActionItem
          key="exclude-from-filter"
          data-test-id="exclude-from-filter"
          onClick={() => this.handleCellAction(Actions.EXCLUDE, value)}
        >
          {t('Exclude from filter')}
        </ActionItem>
      );
    }

    if (column.type !== 'string' && column.type !== 'boolean') {
      actions.push(
        <ActionItem
          key="show-values-greater-than"
          data-test-id="show-values-greater-than"
          onClick={() => this.handleCellAction(Actions.SHOW_GREATER_THAN, value)}
        >
          {t('Show values greater than')}
        </ActionItem>
      );

      actions.push(
        <ActionItem
          key="show-values-less-than"
          data-test-id="show-values-less-than"
          onClick={() => this.handleCellAction(Actions.SHOW_LESS_THAN, value)}
        >
          {t('Show values less than')}
        </ActionItem>
      );
    }

    if (column.column.kind === 'field' && column.column.field === 'transaction') {
      actions.push(
        <ActionItem
          key="transaction-summary"
          data-test-id="transaction-summary"
          onClick={() => this.handleCellAction(Actions.TRANSACTION, value)}
        >
          {t('Go to summary')}
        </ActionItem>
      );
    }

    if (column.column.kind === 'field' && column.column.field === 'release') {
      actions.push(
        <ActionItem
          key="release"
          data-test-id="release"
          onClick={() => this.handleCellAction(Actions.RELEASE, value)}
        >
          {t('Go to release')}
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

    const {dataRow, column} = this.props;
    const fieldAlias = getAggregateAlias(column.name);
    const value = dataRow[fieldAlias];

    // do not display per cell actions for count() and count_unique()
    const shouldIgnoreColumn =
      column.column.kind === 'function' &&
      (column.column.function[0] === 'count' ||
        column.column.function[0] === 'count_unique');

    if (!defined(value) || shouldIgnoreColumn) {
      // per cell actions do not apply to values that are null
      return <React.Fragment>{children}</React.Fragment>;
    }

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

export default withProjects(CellAction);

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
