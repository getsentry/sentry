import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {navigateTo} from '../../actionCreators/navigation';
import {t} from '../../locale';
import AutoComplete from '../autoComplete';
import LoadingIndicator from '../loadingIndicator';
import SearchResult from './searchResult';
import SearchResultWrapper from './searchResultWrapper';
import SearchSources from './sources';
import replaceRouterParams from '../../utils/replaceRouterParams';

// "Omni" search
class Search extends React.Component {
  static propTypes = {
    router: PropTypes.object,
    maxResults: PropTypes.number,
    minSearch: PropTypes.number,
    renderInput: PropTypes.func,
    renderItem: PropTypes.func,
    dropdownStyle: PropTypes.string,
    searchOptions: PropTypes.object,
  };

  handleSelect = (item, state) => {
    if (!item) return;

    let {to} = item;
    if (!to) return;

    let {params, router} = this.props;
    let nextPath = replaceRouterParams(to, params);

    navigateTo(nextPath, router);
  };

  renderItem({item, index, highlightedIndex, getItemProps}) {
    let {renderItem} = this.props;
    let highlighted = index === highlightedIndex;
    let key = `${item.item.title}-${index}`;
    let itemProps = {
      ...getItemProps({
        item: item.item,
      }),
    };

    if (typeof renderItem === 'function') {
      return React.cloneElement(
        renderItem({
          ...item,
          index,
          highlighted,
        }),
        {
          ...itemProps,
          key,
        }
      );
    }

    return (
      <SearchResultWrapper {...itemProps} highlighted={highlighted} key={key}>
        <SearchResult {...item} />
      </SearchResultWrapper>
    );
  }

  render() {
    let {
      params,
      dropdownStyle,
      searchOptions,
      minSearch,
      maxResults,
      renderItem,
      renderInput,
    } = this.props;

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
          let isValidSearch = inputValue.length >= minSearch;

          return (
            <SearchWrapper>
              {renderInput({
                getInputProps,
              })}

              {isValidSearch && isOpen ? (
                <SearchSources
                  searchOptions={searchOptions}
                  query={searchQuery}
                  params={params}
                >
                  {({isLoading, results, hasAnyResults}) => (
                    <DropdownBox css={dropdownStyle}>
                      {isLoading && (
                        <Flex justify="center" align="center" p={1}>
                          <LoadingIndicator mini hideMessage relative />
                        </Flex>
                      )}

                      {!isLoading &&
                        results.splice(0, maxResults).map((item, index) => {
                          let highlighted = index === highlightedIndex;
                          let key = `${item.item.title}-${index}`;
                          let itemProps = {
                            ...getItemProps({
                              item: item.item,
                            }),
                          };

                          if (typeof renderItem === 'function') {
                            return React.cloneElement(
                              renderItem({
                                ...item,
                                index,
                                highlighted,
                              }),
                              {
                                ...itemProps,
                                key,
                              }
                            );
                          }

                          return (
                            <SearchResultWrapper
                              {...itemProps}
                              highlighted={highlighted}
                              key={key}
                            >
                              <SearchResult {...item} />
                            </SearchResultWrapper>
                          );
                        })}

                      {!isLoading &&
                        !hasAnyResults && <EmptyItem>{t('No results found')}</EmptyItem>}
                    </DropdownBox>
                  )}
                </SearchSources>
              ) : null}
            </SearchWrapper>
          );
        }}
      </AutoComplete>
    );
  }
}

export default withRouter(Search);

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

const SearchWrapper = styled.div`
  position: relative;
`;

const EmptyItem = styled(SearchResultWrapper)`
  text-align: center;
  padding: 16px;
  opacity: 0.5;
`;
