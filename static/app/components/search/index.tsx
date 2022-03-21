import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {navigateTo} from 'sentry/actionCreators/navigation';
import AutoComplete from 'sentry/components/autoComplete';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SearchResult from 'sentry/components/search/searchResult';
import SearchResultWrapper from 'sentry/components/search/searchResultWrapper';
import SearchSources from 'sentry/components/search/sources';
import ApiSource from 'sentry/components/search/sources/apiSource';
import CommandSource from 'sentry/components/search/sources/commandSource';
import FormSource from 'sentry/components/search/sources/formSource';
import RouteSource from 'sentry/components/search/sources/routeSource';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {Fuse} from 'sentry/utils/fuzzySearch';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';

import {Result} from './sources/types';

interface InputProps
  extends Pick<
    Parameters<AutoComplete<Result['item']>['props']['children']>[0],
    'getInputProps'
  > {}

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
interface ItemProps {
  highlighted: boolean;
  index: number;
  item: Result['item'];
  itemProps: React.ComponentProps<typeof SearchResultWrapper>;
  matches: Result['matches'];
}
interface SearchProps extends WithRouterProps<{orgId: string}> {
  /**
   * For analytics
   */
  entryPoint: 'settings_search' | 'command_palette' | 'sidebar_help';
  /**
   * Maximum number of results to display
   */
  maxResults: number;
  /**
   * Minimum number of characters before search activates
   */
  minSearch: number;
  /**
   * Render prop for the main input for the search
   */
  renderInput: (props: InputProps) => React.ReactNode;

  /**
   * Passed to the underlying AutoComplete component
   */
  closeOnSelect?: boolean;
  /**
   * Additional CSS for the dropdown menu.
   */
  dropdownStyle?: string;
  /**
   * Render an item in the search results.
   */
  renderItem?: (props: ItemProps) => React.ReactElement;
  /**
   * Adds a footer below the results when the search is complete
   */
  resultFooter?: React.ReactElement;
  /**
   * Fuse search options
   */
  searchOptions?: Fuse.IFuseOptions<any>;
  /**
   * The sources to query
   */
  sources?: React.ComponentType[];
}

function Search(props: SearchProps): React.ReactElement {
  React.useEffect(() => {
    trackAdvancedAnalyticsEvent(`${props.entryPoint}.open`, {
      organization: null,
    });
  }, [props.entryPoint]);

  const handleSelectItem = React.useCallback(
    (item: Result['item'], state?: AutoComplete<Result['item']>['state']) => {
      if (!item) {
        return;
      }

      trackAdvancedAnalyticsEvent(`${props.entryPoint}.select`, {
        query: state?.inputValue,
        result_type: item.resultType,
        source_type: item.sourceType,
        organization: null,
      });

      // `action` refers to a callback function while
      // `to` is a react-router route
      if (typeof item.action === 'function') {
        item.action(item, state);
        return;
      }

      if (!item.to) {
        return;
      }

      if (item.to.startsWith('http')) {
        const open = window.open();

        if (open) {
          open.opener = null;
          open.location.href = item.to;
          return;
        }

        addErrorMessage(
          t('Unable to open search result (a popup blocker may have caused this).')
        );
        return;
      }

      const nextPath = replaceRouterParams(item.to, props.params);

      navigateTo(nextPath, props.router, item.configUrl);
    },
    [props.entryPoint, props.router, props.params]
  );

  const saveQueryMetrics = React.useCallback(
    (query: string) => {
      if (!query) {
        return;
      }

      trackAdvancedAnalyticsEvent(`${props.entryPoint}.query`, {
        query,
        organization: null,
      });
    },
    [props.entryPoint]
  );

  const debouncedSaveQueryMetrics = React.useMemo(() => {
    return debounce(saveQueryMetrics, 200);
  }, [props.entryPoint, saveQueryMetrics]);

  return (
    <AutoComplete
      defaultHighlightedIndex={0}
      onSelect={handleSelectItem}
      closeOnSelect={props.closeOnSelect ?? true}
    >
      {({getInputProps, getItemProps, isOpen, inputValue, highlightedIndex}) => {
        const searchQuery = inputValue.toLowerCase().trim();
        const isValidSearch = inputValue.length >= props.minSearch;

        debouncedSaveQueryMetrics(searchQuery);

        const renderItem =
          typeof props.renderItem === 'function'
            ? props.renderItem
            : ({
                item,
                matches,
                itemProps,
                highlighted,
              }: ItemProps): React.ReactElement => (
                <SearchResultWrapper {...itemProps} highlighted={highlighted}>
                  <SearchResult highlighted={highlighted} item={item} matches={matches} />
                </SearchResultWrapper>
              );

        return (
          <SearchWrapper>
            {props.renderInput({getInputProps})}

            {isValidSearch && isOpen ? (
              <SearchSources
                searchOptions={props.searchOptions}
                query={searchQuery}
                params={props.params}
                sources={
                  props.sources ??
                  ([
                    ApiSource,
                    FormSource,
                    RouteSource,
                    CommandSource,
                  ] as React.ComponentType[])
                }
              >
                {({isLoading, results, hasAnyResults}) => (
                  <DropdownBox className={props.dropdownStyle}>
                    {isLoading ? (
                      <LoadingWrapper>
                        <LoadingIndicator mini hideMessage relative />
                      </LoadingWrapper>
                    ) : !hasAnyResults ? (
                      <EmptyItem>{t('No results found')}</EmptyItem>
                    ) : (
                      results.slice(0, props.maxResults).map((resultObj, index) => {
                        return React.cloneElement(
                          renderItem({
                            index,
                            item: resultObj.item,
                            matches: resultObj.matches,
                            highlighted: index === highlightedIndex,
                            itemProps: getItemProps({
                              item: resultObj.item,
                              index,
                            }),
                          }),
                          {key: `${resultObj.item.title}-${index}`}
                        );
                      })
                    )}
                    {!isLoading && props.resultFooter ? (
                      <ResultFooter>{props.resultFooter}</ResultFooter>
                    ) : null}
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

const WithRouterSearch = withRouter(Search);
export {WithRouterSearch as Search, SearchProps};

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
