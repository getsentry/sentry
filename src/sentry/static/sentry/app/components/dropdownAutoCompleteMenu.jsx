import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import AutoComplete from 'app/components/autoComplete';
import Input from 'app/views/settings/components/forms/controls/input';
import space from 'app/styles/space';
import LoadingIndicator from 'app/components/loadingIndicator';

class DropdownAutoCompleteMenu extends React.Component {
  static propTypes = {
    items: PropTypes.oneOfType([
      // flat item array
      PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.node,
        })
      ),
      // grouped item array
      PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.node,
          items: PropTypes.arrayOf(
            PropTypes.shape({
              value: PropTypes.string,
              label: PropTypes.node,
              searchKey: PropTypes.string,
            })
          ),
        })
      ),
    ]),
    isOpen: PropTypes.bool,

    /**
     * Show loading indicator next to input
     */
    busy: PropTypes.bool,

    onSelect: PropTypes.func,
    /**
     * When AutoComplete input changes
     */
    onChange: PropTypes.func,

    /**
     * Message to display when there are no items initially
     */
    emptyMessage: PropTypes.node,

    /**
     * Message to display when there are no items that match the search
     */
    noResultsMessage: PropTypes.node,

    /**
     * Presentational properties
     */

    /**
     * Dropdown menu alignment.
     */
    alignMenu: PropTypes.oneOf(['left', 'right']),
    /**
     * Should menu visually lock to a direction (so we don't display a rounded corner)
     */
    blendCorner: PropTypes.bool,
    menuFooter: PropTypes.element,
    menuHeader: PropTypes.element,

    /**
     * Props to pass to menu component
     */
    menuProps: PropTypes.object,

    css: PropTypes.object,
    style: PropTypes.object,
  };

  static defaultProps = {
    onSelect: () => {},
    blendCorner: true,
    emptyMessage: t('No items'),
  };

  filterItems = (items, inputValue) =>
    items.filter(item => {
      return (
        (item.searchKey || `${item.value} ${item.label}`)
          .toLowerCase()
          .indexOf(inputValue.toLowerCase()) > -1
      );
    });

  filterGroupedItems = (groups, inputValue) =>
    groups
      .map(group => {
        return {
          ...group,
          items: this.filterItems(group.items, inputValue),
        };
      })
      .filter(group => group.items.length > 0);

  autoCompleteFilter = (items, inputValue) => {
    let itemCount = 0;

    if (items[0] && items[0].items) {
      //if the first item has children, we assume it is a group
      return _.flatMap(this.filterGroupedItems(items, inputValue), item => {
        return [
          {...item, groupLabel: true},
          ...item.items.map(groupedItem => ({...groupedItem, index: itemCount++})),
        ];
      });
    } else {
      return this.filterItems(items, inputValue).map((item, index) => ({...item, index}));
    }
  };

  render() {
    let {
      onSelect,
      onChange,
      children,
      items,
      menuProps,
      alignMenu,
      blendCorner,
      emptyMessage,
      noResultsMessage,
      style,
      menuHeader,
      menuFooter,
      busy,
      ...props
    } = this.props;

    return (
      <AutoComplete
        resetInputOnClose
        itemToString={item => ''}
        onSelect={onSelect}
        inputIsActor={false}
        {...props}
      >
        {({
          getActorProps,
          getRootProps,
          getInputProps,
          getMenuProps,
          getItemProps,
          inputValue,
          selectedItem,
          highlightedIndex,
          isOpen,
          actions,
        }) => {
          // Only filter results if menu is open
          let autoCompleteResults =
            (isOpen && this.autoCompleteFilter(items, inputValue)) || [];
          let hasItems = items && !!items.length;
          let hasResults = !!autoCompleteResults.length;
          let showNoItems = !busy && !inputValue && !hasItems;
          // Results mean there was a search (i.e. inputValue)
          let showNoResultsMessage = !busy && inputValue && !hasResults;

          return (
            <AutoCompleteRoot {...getRootProps()}>
              {children({
                getActorProps,
                actions,
                isOpen,
                selectedItem,
              })}

              {isOpen && (
                <StyledMenu
                  {...getMenuProps({
                    ...menuProps,
                    style,
                    isStyled: true,
                    css: this.props.css,
                    blendCorner,
                    alignMenu,
                  })}
                >
                  <Flex>
                    <StyledInput
                      autoFocus
                      placeholder="Filter search"
                      {...getInputProps({onChange})}
                    />
                    <InputLoadingWrapper>
                      {busy && <LoadingIndicator size={16} mini />}
                    </InputLoadingWrapper>
                  </Flex>
                  <div>
                    {menuHeader && <StyledLabel>{menuHeader}</StyledLabel>}

                    {showNoItems && <EmptyMessage>{emptyMessage}</EmptyMessage>}
                    {showNoResultsMessage && (
                      <EmptyMessage>
                        {noResultsMessage || `${emptyMessage} ${t('found')}`}
                      </EmptyMessage>
                    )}
                    {busy && (
                      <Flex justify="center" p={1}>
                        <EmptyMessage>{t('Searching...')}</EmptyMessage>
                      </Flex>
                    )}
                    {!busy &&
                      autoCompleteResults.map(
                        ({index, ...item}) =>
                          item.groupLabel ? (
                            <StyledLabel key={item.value}>{item.label}</StyledLabel>
                          ) : (
                            <AutoCompleteItem
                              key={`${item.value}-${index}`}
                              index={index}
                              highlightedIndex={highlightedIndex}
                              {...getItemProps({item, index})}
                            >
                              {item.label}
                            </AutoCompleteItem>
                          )
                      )}
                    {menuFooter && <StyledLabel>{menuFooter}</StyledLabel>}
                  </div>
                </StyledMenu>
              )}
            </AutoCompleteRoot>
          );
        }}
      </AutoComplete>
    );
  }
}

/**
 * If `blendCorner` is false, then we apply border-radius to all corners
 *
 * Otherwise apply radius to opposite side of `alignMenu`
 */
const getMenuBorderRadius = ({blendCorner, alignMenu, theme}) => {
  let radius = theme.borderRadius;
  if (!blendCorner) {
    return css`
      border-radius: ${radius};
    `;
  }

  let hasTopLeftRadius = alignMenu !== 'left';
  let hasTopRightRadius = !hasTopLeftRadius;

  return css`
    border-radius: ${hasTopLeftRadius ? radius : 0} ${hasTopRightRadius ? radius : 0}
      ${radius} ${radius};
  `;
};

const AutoCompleteRoot = styled(({isOpen, ...props}) => <div {...props} />)`
  position: relative;
  display: inline-block;
`;

const InputLoadingWrapper = styled(Flex)`
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  flex-shrink: 0;
  width: 30px;
`;

const StyledInput = styled(Input)`
  flex: 1;

  &,
  &:focus,
  &:active,
  &:hover {
    border: 1px solid transparent;
    border-bottom: 1px solid ${p => p.theme.borderLight};
    border-radius: 0;
    box-shadow: none;
    font-size: 13px;
    padding: ${space(2)} ${space(1)};
    font-weight: normal;
    color: ${p => p.gray2};
  }
`;

const AutoCompleteItem = styled('div')`
  background-color: ${p =>
    p.index == p.highlightedIndex ? p.theme.offWhite : 'transparent'};
  padding: ${space(1)};
  cursor: pointer;
  border-bottom: 1px solid ${p => p.theme.borderLighter};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${p => p.theme.offWhite};
  }
`;

const StyledLabel = styled('div')`
  padding: ${space(0.25)} ${space(1)};
  background-color: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-width: 1px 0;

  &:first-child {
    border-top: none;
  }
`;

const StyledMenu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: calc(100% - 1px);
  min-width: 250px;
  z-index: 1;
  max-height: 300px;
  overflow-y: auto;
  right: 0;
  box-shadow: ${p => p.theme.dropShadowLight};

  ${getMenuBorderRadius};
  ${({alignMenu}) => (alignMenu === 'left' ? 'left: 0;' : '')};
`;

const EmptyMessage = styled('div')`
  color: ${p => p.theme.gray1};
  padding: ${space(1)} ${space(2)};
  text-align: center;
  font-size: 1.2em;
  text-transform: none;
`;

export default DropdownAutoCompleteMenu;
