import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {navigateTo} from 'app/actionCreators/navigation';
import AutoComplete from 'app/components/autoComplete';
import LoadingIndicator from 'app/components/loadingIndicator';
import SearchResult from 'app/components/search/searchResult';
import SearchResultWrapper from 'app/components/search/searchResultWrapper';
import SearchSources from 'app/components/search/sources';
import ApiSource from 'app/components/search/sources/apiSource';
import CommandSource from 'app/components/search/sources/commandSource';
import FormSource from 'app/components/search/sources/formSource';
import RouteSource from 'app/components/search/sources/routeSource';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import replaceRouterParams from 'app/utils/replaceRouterParams';

import {Result} from './sources/types';

type Item = Result['item'];

type InputProps = Pick<
  Parameters<AutoComplete<Item>['props']['children']>[0],
  'getInputProps'
>;

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
type ItemProps = {
  item: Item;
  matches: Result['matches'];
  index: number;
  highlighted: boolean;
  itemProps: React.ComponentProps<typeof SearchResultWrapper>;
};

// Not using typeof defaultProps because of the wrapping HOC which
// causes defaultProp magic to fall off.
const defaultProps = {
  renderItem: ({
    item,
    matches,
    itemProps,
    highlighted,
  }: ItemProps): React.ReactElement => (
    <SearchResultWrapper {...itemProps} highlighted={highlighted}>
      <SearchResult highlighted={highlighted} item={item} matches={matches} />
    </SearchResultWrapper>
  ),
  sources: [ApiSource, FormSource, RouteSource, CommandSource] as React.ComponentType[],
  closeOnSelect: true,
};

type Props = WithRouterProps<{orgId: string}> & {
  /**
   * For analytics
   */
  entryPoint: 'settings_search' | 'command_palette' | 'sidebar_help';
  /**
   * Render prop for the main input for the search
   */
  renderInput: (props: InputProps) => React.ReactNode;
  /**
   * Maximum number of results to display
   */
  maxResults: number;
  /**
   * Minimum number of characters before search activates
   */
  minSearch: number;

  searchOptions?: Fuse.FuseOptions<any>;
  /**
   * Additional CSS for the dropdown menu.
   */
  dropdownStyle?: string;
  /**
   * Adds a footer below the results when the search is complete
   */
  resultFooter?: React.ReactElement;
  /**
   * Render an item in the search results.
   */
  renderItem?: (props: ItemProps) => React.ReactElement;
  /**
   * Passed to the underlying AutoComplete component
   */
  closeOnSelect?: boolean;
  /**
   * The sources to query
   */
  sources?: React.ComponentType[];
};

// "Omni" search
class Search extends React.Component<Props> {
  static defaultProps = defaultProps;

  componentDidMount() {
    trackAnalyticsEvent({
      eventKey: `${this.props.entryPoint}.open`,
      eventName: `${this.props.entryPoint} Open`,
      organization_id: null,
    });
  }

  handleSelect = (item: Item, state?: AutoComplete<Item>['state']) => {
    if (!item) {
      return;
    }

    trackAnalyticsEvent({
      eventKey: `${this.props.entryPoint}.select`,
      eventName: `${this.props.entryPoint} Select`,
      query: state && state.inputValue,
      result_type: item.resultType,
      source_type: item.sourceType,
      organization_id: null,
    });

    const {to, action, configUrl} = item;

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
      open.location.href = to;
      return;
    }

    const {params, router} = this.props;
    const nextPath = replaceRouterParams(to, params);

    navigateTo(nextPath, router, configUrl);
  };

  saveQueryMetrics = debounce(query => {
    if (!query) {
      return;
    }
    trackAnalyticsEvent({
      eventKey: `${this.props.entryPoint}.query`,
      eventName: `${this.props.entryPoint} Query`,
      query,
      organization_id: null,
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

    const renderedItem = renderItem({
      item,
      matches,
      index,
      highlighted,
      itemProps,
    });

    return React.cloneElement(renderedItem, {key});
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
      resultFooter,
    } = this.props;

    return (
      <AutoComplete
        defaultHighlightedIndex={0}
        onSelect={this.handleSelect}
        closeOnSelect={closeOnSelect}
      >
        {({getInputProps, getItemProps, isOpen, inputValue, highlightedIndex}) => {
          const searchQuery = inputValue.toLowerCase().trim();
          const isValidSearch = inputValue.length >= minSearch;

          this.saveQueryMetrics(searchQuery);

          return (
            <SearchWrapper>
              {renderInput({getInputProps})}

              {isValidSearch && isOpen ? (
                <SearchSources
                  searchOptions={searchOptions}
                  query={searchQuery}
                  params={params}
                  sources={sources ?? defaultProps.sources}
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
                      {!isLoading && resultFooter && (
                        <ResultFooter>{resultFooter}</ResultFooter>
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
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  position: absolute;
  top: 36px;
  right: 0;
  width: 400px;
  border-radius: 5px;
  overflow: auto;
  max-height: 60vh;
`;

const SearchWrapper = styled('div')`
  position: relative;
`;

const ResultFooter = styled('div')`
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
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
