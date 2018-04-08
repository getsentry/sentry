import {Flex} from 'grid-emotion';
import {Link} from 'react-router';
import {css} from 'emotion';
import {flatten} from 'lodash';
import keydown from 'react-keydown';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {loadSearchMap} from '../../../../actionCreators/formSearch';
import {navigateTo} from '../../../../actionCreators/navigation';
import {t} from '../../../../locale';
import ApiSearch from '../../../../components/search/apiSearch';
import AutoComplete from '../../../../components/autoComplete';
import FormFieldSearch from '../../../../components/search/formFieldSearch';
import InlineSvg from '../../../../components/inlineSvg';
import LoadingIndicator from '../../../../components/loadingIndicator';
import RouteSearch from '../../../../components/search/routeSearch';
import SearchResult from './searchResult';
import replaceRouterParams from '../../../../utils/replaceRouterParams';

const MIN_SEARCH_LENGTH = 1;
const MAX_RESULTS = 10;

class SettingsSearch extends React.Component {
  static propTypes = {
    route: PropTypes.object,
    router: PropTypes.object,
  };

  componentDidMount() {
    // Loads form fields
    loadSearchMap();
  }

  handleSelect = (item, state) => {
    if (!item) return;

    let {to} = item;
    if (!to) return;

    let {params, router} = this.props;
    let nextPath = replaceRouterParams(to, params);

    navigateTo(nextPath, router);
  };

  @keydown('/')
  handleFocusSearch(e) {
    if (!this.searchInput) return;
    if (e.target === this.searchInput) return;

    e.preventDefault();
    this.searchInput.focus();
  }

  render() {
    let {params} = this.props;

    return (
      <AutoComplete
        defaultHighlightedIndex={0}
        itemToString={() => ''}
        onSelect={this.handleSelect}
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
          let searchQuery = inputValue.toLowerCase();
          let isValidSearch = inputValue.length >= MIN_SEARCH_LENGTH;

          return (
            <SettingsSearchWrapper>
              <SearchInputWrapper>
                <SearchInputIcon size="14px" />
                <SearchInput
                  innerRef={ref => (this.searchInput = ref)}
                  {...getInputProps({
                    type: 'text',
                    placeholder: t('Press "/" to search settings'),
                  })}
                />
              </SearchInputWrapper>

              {isValidSearch && isOpen ? (
                <ApiSearch query={searchQuery}>
                  {apiArgs => (
                    <FormFieldSearch params={params} query={searchQuery}>
                      {formFieldArgs => (
                        <RouteSearch params={params} query={searchQuery}>
                          {routeArgs => {
                            let allArgs = [apiArgs, formFieldArgs, routeArgs];
                            // loading means if any result has `isLoading` OR any result is null
                            let isLoading = !!allArgs.find(
                              arg => arg.isLoading || arg.results === null
                            );

                            // Only use first `MAX_RESULTS` after sorting by score
                            let foundResults =
                              (!isLoading &&
                                flatten(allArgs.map(({results}) => results || []))
                                  .sort((a, b) => a.score - b.score)
                                  .slice(0, MAX_RESULTS)) ||
                              [];
                            let hasAnyResults = !!foundResults.length;

                            return (
                              <DropdownBox>
                                {isLoading && (
                                  <Flex justify="center" align="center" p={1}>
                                    <LoadingIndicator mini hideMessage relative />
                                  </Flex>
                                )}
                                {foundResults.map((item, index) => {
                                  return (
                                    <SearchItem
                                      {...getItemProps({
                                        item: item.item,
                                      })}
                                      highlighted={index === highlightedIndex}
                                      key={`${item.item.title}-${index}`}
                                    >
                                      <SearchResult {...item} {...this.props} />
                                    </SearchItem>
                                  );
                                })}

                                {!isLoading &&
                                  !hasAnyResults && (
                                    <EmptyItem>{t('No results found')}</EmptyItem>
                                  )}
                              </DropdownBox>
                            );
                          }}
                        </RouteSearch>
                      )}
                    </FormFieldSearch>
                  )}
                </ApiSearch>
              ) : null}
            </SettingsSearchWrapper>
          );
        }}
      </AutoComplete>
    );
  }
}

export default SettingsSearch;

const SearchInputWrapper = styled.div`
  position: relative;
`;

const SearchInputIcon = styled(props => <InlineSvg src="icon-search" {...props} />)`
  color: ${p => p.theme.gray2}
  position: absolute;
  left: 10px;
  top: 8px;
`;

const SearchInput = styled.input`
  transition: border-color 0.15s ease;
  font-size: 14px;
  width: 260px;
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

const SettingsSearchWrapper = styled.div`
  position: relative;
`;

const SearchItem = styled(({highlighted, ...props}) => <Link {...props} />)`
  display: block;
  color: ${p => p.theme.gray5};
  padding: 10px;
  border-bottom: 1px solid ${p => p.theme.borderLight};

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purpleDarkest};
      background: ${p.theme.offWhite};
    `};

  &:first-child {
    border-radius: 5px 5px 0 0;
  }

  &:last-child {
    border-bottom: 0;
    border-radius: 0 0 5px 5px;
  }
`;

const EmptyItem = styled(SearchItem)`
  text-align: center;
  padding: 16px;
  opacity: 0.5;
`;
