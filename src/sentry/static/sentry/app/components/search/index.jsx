import debounce from 'lodash/debounce';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {navigateTo} from 'app/actionCreators/navigation';
import {t} from 'app/locale';
import ApiSource from 'app/components/search/sources/apiSource';
import AutoComplete from 'app/components/autoComplete';
import CommandSource from 'app/components/search/sources/commandSource';
import FormSource from 'app/components/search/sources/formSource';
import LoadingIndicator from 'app/components/loadingIndicator';
import RouteSource from 'app/components/search/sources/routeSource';
import SearchResult from 'app/components/search/searchResult';
import SearchResultWrapper from 'app/components/search/searchResultWrapper';
import SearchSources from 'app/components/search/sources';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import space from 'app/styles/space';

// "Omni" search
class Search extends React.Component {
  static propTypes = {
    // For analytics
    entryPoint: PropTypes.oneOf(['settings_search', 'command_palette', 'sidebar_help'])
      .isRequired,

    sources: PropTypes.array.isRequired,

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
    // Passed to the underlying AutoComplete component
    closeOnSelect: PropTypes.bool,
  };

  static defaultProps = {
    // Default Search result rendering
    renderItem: ({item, matches, itemProps, highlighted}) => (
      <SearchResultWrapper {...itemProps} highlighted={highlighted}>
        <SearchResult highlighted={highlighted} item={item} matches={matches} />
      </SearchResultWrapper>
    ),
    sources: [ApiSource, FormSource, RouteSource, CommandSource],
    closeOnSelect: true,
  };

  componentDidMount() {
    trackAnalyticsEvent({
      eventKey: `${this.props.entryPoint}.open`,
      eventName: `${this.props.entryPoint} Open`,
    });
  }

  handleSelect = (item, state) => {
    if (!item) {
      return;
    }

    trackAnalyticsEvent({
      eventKey: `${this.props.entryPoint}.select`,
      eventName: `${this.props.entryPoint} Select`,
      query: state && state.inputValue,
      result_type: item.resultType,
      source_type: item.sourceType,
    });

    const {to, action} = item;

    // `action` refers to a callback function while
    // `to` is a react-router route
    if (action) {
      action(item, state);
      return;
    }

    if (!to) {
      return;
    }

    if (to.startsWith('http')) {
      const open = window.open();
      if (open === null) {
        addErrorMessage(
          t('Unable to open search result (a popup blocker may have caused this).')
        );
        return;
      }

      open.opener = null;
      open.location = to;
      return;
    }

    const {params, router} = this.props;
    const nextPath = replaceRouterParams(to, params);

    navigateTo(nextPath, router);
  };

  saveQueryMetrics = debounce(query => {
    if (!query) {
      return;
    }
    trackAnalyticsEvent({
      eventKey: `${this.props.entryPoint}.query`,
      eventName: `${this.props.entryPoint} Query`,
      query,
    });
  }, 200);

  renderItem = ({resultObj, index, highlightedIndex, getItemProps}) => {
    // resultObj is a fuse.js result object with {item, matches, score}
    const {renderItem} = this.props;
    const highlighted = index === highlightedIndex;
    const {item, matches} = resultObj;
    const key = `${item.title}-${index}`;
    const itemProps = {
      ...getItemProps({
        item,
        index,
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
    const {
      params,
      dropdownStyle,
      searchOptions,
      minSearch,
      maxResults,
      renderInput,
      sources,
      closeOnSelect,
    } = this.props;

    return (
      <AutoComplete
        defaultHighlightedIndex={0}
        itemToString={() => ''}
        onSelect={this.handleSelect}
        closeOnSelect={closeOnSelect}
      >
        {({
          getInputProps,
          getItemProps,
          isOpen,
          inputValue,
          selectedItem: _selectedItem,
          highlightedIndex,
          onChange: _onChange,
        }) => {
          const searchQuery = inputValue.toLowerCase().trim();
          const isValidSearch = inputValue.length >= minSearch;

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
                  sources={sources}
                >
                  {({isLoading, results, hasAnyResults}) => (
                    <DropdownBox className={dropdownStyle}>
                      {isLoading && (
                        <LoadingWrapper>
                          <LoadingIndicator mini hideMessage relative />
                        </LoadingWrapper>
                      )}
                      {!isLoading &&
                        results.slice(0, maxResults).map((resultObj, index) =>
                          this.renderItem({
                            resultObj,
                            index,
                            highlightedIndex,
                            getItemProps,
                          })
                        )}
                      {!isLoading && !hasAnyResults && (
                        <EmptyItem>{t('No results found')}</EmptyItem>
                      )}
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

const DropdownBox = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  position: absolute;
  top: 36px;
  right: 0;
  width: 400px;
  border-radius: 5px;
  overflow: hidden;
`;

const SearchWrapper = styled('div')`
  position: relative;
`;

const EmptyItem = styled(SearchResultWrapper)`
  text-align: center;
  padding: 16px;
  opacity: 0.5;
`;

const LoadingWrapper = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(1)};
`;
