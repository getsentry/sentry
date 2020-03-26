import React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';
import * as PopperJS from 'popper.js';
import {Manager, Reference, Popper} from 'react-popper';

import {t} from 'app/locale';
import {IconEllipsis} from 'app/icons';
import EventView from 'app/utils/discover/eventView';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {OrganizationSummary} from 'app/types';

import {TableColumn, TableDataRow} from './types';

enum Actions {
  ADD,
  EXCLUDE,
}

type Props = {
  eventView: EventView;
  organization: OrganizationSummary;
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  children: React.ReactNode;
};

type State = {
  isHovering: boolean;
  isOpen: boolean;
};

export default class CellAction extends React.Component<Props, State> {
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

  handleUpdateSearch = (action: Actions, value: React.ReactText) => {
    const {eventView, column, organization} = this.props;
    const query = tokenizeSearch(eventView.query);
    switch (action) {
      case Actions.ADD:
        // Remove exclusion if it exists.
        delete query[`!${column.name}`];
        query[column.name] = [`${value}`];
        break;
      case Actions.EXCLUDE:
        // Remove positive if it exists.
        delete query[`${column.name}`];
        // Negations should stack up.
        const negation = `!${column.name}`;
        if (!query.hasOwnProperty(negation)) {
          query[negation] = [];
        }
        query[negation].push(`${value}`);
        break;
      default:
        throw new Error(`Unknown action type. ${action}`);
    }
    const nextView = eventView.clone();
    nextView.query = stringifyQueryObject(query);

    browserHistory.push(nextView.getResultsViewUrlTarget(organization.slug));
  };

  handleMenuToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    this.setState({isOpen: !this.state.isOpen});
  };

  renderMenu() {
    const {dataRow, column} = this.props;
    const {isOpen} = this.state;

    const value = dataRow[column.name];
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
              <MenuButtons>
                <ActionItem
                  data-test-id="add-to-filter"
                  onClick={() => this.handleUpdateSearch(Actions.ADD, value)}
                >
                  {t('Add to filter')}
                </ActionItem>
                <ActionItem
                  data-test-id="exclude-from-filter"
                  onClick={() => this.handleUpdateSearch(Actions.EXCLUDE, value)}
                >
                  {t('Exclude from filter')}
                </ActionItem>
              </MenuButtons>
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
                <IconEllipsis size="sm" data-test-id="cell-action" color={theme.blue} />
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
    background: ${p => p.theme.offWhite};
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
