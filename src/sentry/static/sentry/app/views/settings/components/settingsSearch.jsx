import {Link, browserHistory} from 'react-router';
import {css} from 'emotion';
import React from 'react';
import styled from 'react-emotion';

import AutoComplete from '../../../components/autoComplete';
import {searchIndex as orgSearchIndex} from '../../../data/forms/organizationGeneralSettings';
import {searchIndex as teamSearchIndex} from '../../../data/forms/teamSettingsFields';
import {t} from '../../../locale';
import IconSearch from '../../../icons/icon-search';
import replaceRouterParams from '../../../utils/replaceRouterParams';

const MIN_SEARCH_LENGTH = 2;

const searchIndex = Object.assign({}, orgSearchIndex, teamSearchIndex);

const SearchInputWrapper = styled.div`
  position: relative;
`;

const SearchInputIcon = styled(IconSearch)`
  color: ${p => p.theme.gray2}
  position: absolute;
  left: 10px;
  top: 8px;
`;

const SearchInput = styled.input`
  transition: border-color 0.15s ease;
  font-size: 14px;
  width: 220px;
  line-height: 1;
  padding: 5px 8px 4px 28px;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: 30px;
  height: 28px;

  box-shadow: inset ${p => p.theme.dropShadowLight};

  &:focus {
    outline: none;
    border: 1px solid ${p => p.theme.gray1};
  }

  &::placeholder {
    color: ${p => p.theme.gray2};
  }
`;

const DropdownBox = styled.div`
  background: #fff;
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  position: absolute;
  top: 36px;
  right: 0;
  width: 400px;
  border-radius: 5px;
`;

const SettingsSearchContainer = styled.div`
  position: relative;
`;

const SearchItem = styled(Link)`
  display: block;
  color: ${p => p.theme.gray5};
  padding: 16px 16px 14px;
  border-bottom: 1px solid ${p => p.theme.borderLight};

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purpleDarkest};
      background: ${p.theme.offWhite};
    `} &:first-child {
    border-radius: 5px 5px 0 0;
  }

  &:last-child {
    border-bottom: 0;
    border-radius: 0 0 5px 5px;
  }
`;

const SearchDetail = styled.div`
  font-size: 0.8em;
  line-height: 1.3;
  margin-top: 4px;
  color: ${p => p.theme.gray3};
`;

class SettingsSearch extends React.Component {
  static propTypes = {};

  handleSelect = (item, state) => {
    if (!item) return;

    let {to} = item;
    if (!to) return;

    browserHistory.push(item.to);
  };

  render() {
    let {params} = this.props;

    // TODO Create search index based on route
    // (i.e. can only search project settings when a project is in context)

    return (
      <AutoComplete
        defaultHighlightedIndex={0}
        itemToString={() => ''}
        onSelect={this.handleSelect}
        onStateChange={this.handleStateChange}
      >
        {({
          getInputProps,
          getItemProps,
          isOpen,
          inputValue,
          selectedItem,
          highlightedIndex,
          onChange,
        }) => {
          let isValidSearch = inputValue.length > MIN_SEARCH_LENGTH;

          let matches =
            isValidSearch &&
            isOpen &&
            Object.keys(searchIndex)
              .filter(key => key.indexOf(inputValue.toLowerCase()) > -1)
              .filter(key => {
                // TODO: Open up a confirm to ask which project/team/org to use
                // The route doesn't have all params to continue, don't show in search results
                return (
                  !searchIndex[key].requireParams ||
                  !searchIndex[key].requireParams.length ||
                  !searchIndex[key].requireParams.find(
                    param => typeof params[param] === 'undefined'
                  )
                );
              });

          return (
            <SettingsSearchContainer>
              <SearchInputWrapper>
                <SearchInputIcon size="14px" />
                <SearchInput
                  {...getInputProps({
                    type: 'text',
                    placeholder: 'Search settings',
                  })}
                />
              </SearchInputWrapper>

              {isValidSearch && isOpen ? (
                <DropdownBox>
                  {matches && matches.length ? (
                    matches.map((key, index) => {
                      let item = searchIndex[key];
                      let {route, field} = item;
                      let to = `${replaceRouterParams(
                        route,
                        params
                      )}#${encodeURIComponent(field.name)}`;

                      return (
                        <SearchItem
                          {...getItemProps({
                            item: {
                              ...item,
                              to,
                            },
                          })}
                          highlighted={index === highlightedIndex}
                          to={to}
                          key={field.name}
                        >
                          <div>
                            <span>{field.label}</span>
                          </div>

                          <SearchDetail>{field.help}</SearchDetail>
                        </SearchItem>
                      );
                    })
                  ) : (
                    <SearchItem>{t('No results found')}</SearchItem>
                  )}
                </DropdownBox>
              ) : null}
            </SettingsSearchContainer>
          );
        }}
      </AutoComplete>
    );
  }
}

export default SettingsSearch;
