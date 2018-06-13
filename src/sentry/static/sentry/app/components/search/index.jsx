import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {debounce} from 'lodash';

import {navigateTo} from 'app/actionCreators/navigation';
import {t} from 'app/locale';
import analytics from 'app/utils/analytics';
import AutoComplete from 'app/components/autoComplete';
import LoadingIndicator from 'app/components/loadingIndicator';
import SearchResult from 'app/components/search/searchResult';
import SearchResultWrapper from 'app/components/search/searchResultWrapper';
import SearchSources from 'app/components/search/sources';
import replaceRouterParams from 'app/utils/replaceRouterParams';

// "Omni" search
class Search extends React.Component {
  static propTypes = {
    router: PropTypes.object,
    /**
     * Render prop for the main input for the search
     */
    renderInput: PropTypes.func.isRequired,

    /**
     * Maximum number of results to display
     */
    maxResults: PropTypes.number,

    /**
     * Minimum number of characters before search activates
     */
    minSearch: PropTypes.number,

    /**
     * Render prop for search results
     *
     * Args: {
     *  item: Search Item
     *  index: item's index in results
     *  highlighted: is item highlighted
     *  itemProps: props that should be spread for root item
     * }
     */
    renderItem: PropTypes.func,
    dropdownStyle: PropTypes.string,
    searchOptions: PropTypes.object,
  };

  static defaultProps = {
    // Default Search result rendering
    renderItem: ({item, matches, itemProps, highlighted}) => (
      <SearchResultWrapper {...itemProps} highlighted={highlighted}>
        <SearchResult highlighted={highlighted} item={item} matches={matches} />
      </SearchResultWrapper>
    ),
  };

  handleSelect = (item, state) => {
    if (!item) return;

    let {to} = item;
    if (!to) return;

    let {params, router} = this.props;
    let nextPath = replaceRouterParams(to, params);

    navigateTo(nextPath, router);
  };

  saveQueryMetrics = debounce(query => analytics('omnisearch.query', {query}), 200);

  renderItem = ({resultObj, index, highlightedIndex, getItemProps}) => {
    // resultObj is a fuse.js result object with {item, matches, score}
    let {renderItem} = this.props;
    let highlighted = index === highlightedIndex;
    let {item, matches} = resultObj;
    let key = `${item.title}-${index}`;
    let itemProps = {
      ...getItemProps({
        item,
      }),
    };

    if (typeof renderItem !== 'function') {
      throw new Error('Invalid `renderItem`');
    }

    return React.cloneElement(
      renderItem({
        item,
        matches,
        index,
        highlighted,
      }),
      {
        ...itemProps,
        key,
      }
    );
  };

  render() {
    let {
      params,
      dropdownStyle,
      searchOptions,
      minSearch,
      maxResults,
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

          this.saveQueryMetrics(searchQuery);

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
                        results.slice(0, maxResults).map((resultObj, index) => {
                          return this.renderItem({
                            resultObj,
                            index,
                            highlightedIndex,
                            getItemProps,
                          });
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
