import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import AutoComplete from 'app/components/autoComplete';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {
  fetchSavedQueries,
  deleteSavedQuery,
} from 'app/actionCreators/discoverSavedQueries';
import Highlight from 'app/components/highlight';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {SavedQuery} from 'app/stores/discoverSavedQueriesStore';
import EventView from 'app/views/eventsV2/eventView';

import {domId} from 'app/utils/domId';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import withApi from 'app/utils/withApi';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';

import SidebarItem from './sidebarItem';

type Props = {
  api: Client;
  organization: Organization;
  savedQueries: SavedQuery[];
};

type State = {
  isOpen: boolean;
  search: string;
};

class Discover2Item extends React.Component<Props, State> {
  state = {
    search: '',
    isOpen: false,
  };

  componentDidMount() {
    const {api, organization} = this.props;
    fetchSavedQueries(api, organization.slug);
    this.menuId = domId('discover-menu');
  }

  private menuId: string = '';

  handleEnter = () => {
    this.setState({isOpen: true});
  };

  handleLeave = () => {
    this.setState({isOpen: false});
  };

  handleSelect = (item: SavedQuery) => {
    const {organization} = this.props;
    const target = {
      pathname: `/organizations/${organization.slug}/eventsv2/`,
      query: EventView.fromSavedQuery(item).generateQueryStringObject(),
    };
    browserHistory.push(target);
  };

  handleEdit = (event: React.MouseEvent<Element>, item: SavedQuery) => {
    event.preventDefault();
    event.stopPropagation();
    const {organization} = this.props;
    const target = {
      pathname: `/organizations/${organization.slug}/eventsv2/`,
      query: {...EventView.fromSavedQuery(item).generateQueryStringObject(), edit: true},
    };
    browserHistory.push(target);
  };

  handleDelete = (event: React.MouseEvent<Element>, item: SavedQuery) => {
    const {organization, api} = this.props;
    event.preventDefault();
    event.stopPropagation();
    deleteSavedQuery(api, organization.slug, item.id);
  };

  renderSavedQueries({inputValue, getItemProps, highlightedIndex}) {
    const {savedQueries} = this.props;
    if (!savedQueries || savedQueries.length === 0) {
      return (
        <MenuItem role="menuitem" disabled>
          No saved queries
        </MenuItem>
      );
    }
    const lowerInputValue = inputValue.toLowerCase();
    return savedQueries
      .filter(item => {
        return lowerInputValue.length
          ? item.name.toLowerCase().indexOf(lowerInputValue) > -1
          : true;
      })
      .map((item, index) => {
        return (
          <MenuItem
            {...getItemProps({item, index})}
            active={highlightedIndex === index}
            role="menuitem"
            key={item.id}
          >
            <QueryName>
              <Highlight text={inputValue}>{item.name}</Highlight>
            </QueryName>
            <ButtonBar>
              <MenuItemButton
                borderless
                size="xxsmall"
                icon="icon-edit"
                onClick={event => this.handleEdit(event, item)}
              />
              <MenuItemButton
                borderless
                size="xxsmall"
                icon="icon-trash"
                onClick={event => this.handleDelete(event, item)}
              />
            </ButtonBar>
          </MenuItem>
        );
      });
  }

  render() {
    const {organization, savedQueries: _, ...sidebarItemProps} = this.props;
    const {isOpen} = this.state;
    const navProps = {
      'aria-label': t('Discover Saved Queries'),
      'aria-haspopup': true,
      'aria-controls': this.menuId,
      role: 'menubutton',
      onMouseLeave: this.handleLeave,
      onMouseEnter: this.handleEnter,
    };
    if (isOpen) {
      navProps['aria-expanded'] = 'true';
    }

    const sidebarItem = <SidebarItem {...sidebarItemProps} />;
    const inputId = `${this.menuId}-input`;

    return (
      <nav {...navProps}>
        {sidebarItem}
        <AutoComplete
          inputIsActor={false}
          itemToString={item => item.name}
          isOpen={isOpen}
          onSelect={this.handleSelect}
          resetInputOnClose
        >
          {({getInputProps, getItemProps, inputValue, highlightedIndex}) => {
            return (
              <Hitbox role="menu" id={this.menuId} isOpen={isOpen}>
                <InputContainer>
                  <StyledLabel htmlFor={inputId}>
                    <InlineSvg src="icon-search" size="16" />
                  </StyledLabel>
                  <StyledInput
                    type="text"
                    id={inputId}
                    placeholder={t('Filter searches')}
                    {...getInputProps({})}
                  />
                </InputContainer>
                <Menu>
                  {this.renderSavedQueries({
                    getItemProps,
                    inputValue,
                    highlightedIndex,
                  })}
                </Menu>
              </Hitbox>
            );
          }}
        </AutoComplete>
      </nav>
    );
  }
}

export default withApi(withDiscoverSavedQueries(Discover2Item));

type HitboxCustomProps = {
  isOpen: boolean;
};
type HitboxProps = Omit<React.HTMLProps<HTMLDivElement>, keyof HitboxCustomProps> &
  HitboxCustomProps;

const Hitbox = styled('div')<HitboxProps>`
  display: ${p => (p.isOpen ? 'block' : 'none')};
  position: absolute;
  right: -330px;
  width: 350px;
  padding-left: ${space(3)};
  transform: translateY(-30px);
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

const Menu = styled('div')`
  height: 100%;
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.borderDark};
  border-top: none;
  max-height: 245px;
  overflow: auto;
  background-clip: border-box;
`;

type MenuItemProps = {
  active?: boolean;
  disabled?: boolean;
};
const MenuItem = styled('span')<MenuItemProps>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  position: relative;
  padding: ${space(1.5)} ${space(1)} ${space(1.5)} ${space(2)};
  color: ${p => (p.active ? p.theme.gray3 : p.theme.gray2)};
  background: ${p => (p.active ? p.theme.offWhiteLight : p.theme.offWhite)};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  &:focus,
  &:hover {
    background: ${p => (p.disabled ? p.theme.offWhite : p.theme.offWhiteLight)};
    color: ${p => (p.disabled ? p.theme.gray2 : p.theme.gray3)};
    cursor: ${p => (p.disabled ? 'normal' : 'pointer')};
  }
`;

const QueryName = styled('span')`
  ${overflowEllipsis};
  line-height: 1.2;
`;

const StyledLabel = styled('label')<{htmlFor: string}>`
  margin: 0;
  color: ${p => p.theme.gray2};
  padding: ${space(1.5)} ${space(1)} ${space(1.5)} ${space(2)};
`;

const MenuItemButton = styled(Button)`
  color: ${p => p.theme.gray3};
  margin-left: ${space(0.5)};
`;

const InputContainer = styled('div')`
  display: flex;
  align-items: center;
  background: ${p => p.theme.white};
  border-top-right-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.borderDark};
  border-bottom: 0;

  /* Border triangle */
  &::before {
    content: '';
    margin: auto;
    display: block;
    position: absolute;
    left: 11px;
    top: 11px;
    width: 5px;
    height: 10px;
    border-style: solid;
    border-width: 10px 10px 10px 0;
    border-color: transparent #fff transparent transparent;
  }
`;

const StyledInput = styled('input')`
  color: ${p => p.theme.gray2};
  flex-grow: 1;
  height: 38px;
  line-height: 38px;
  background: none;
  outline: none;
  border: none;
`;
