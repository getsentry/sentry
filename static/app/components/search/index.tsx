import {useCallback, useEffect, useMemo} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {navigateTo} from 'sentry/actionCreators/navigation';
import AutoComplete from 'sentry/components/autoComplete';
import SearchSources from 'sentry/components/search/sources';
import ApiSource from 'sentry/components/search/sources/apiSource';
import CommandSource from 'sentry/components/search/sources/commandSource';
import FormSource from 'sentry/components/search/sources/formSource';
import RouteSource from 'sentry/components/search/sources/routeSource';
import {t} from 'sentry/locale';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';

import {Result} from './sources/types';
import List from './list';

type AutoCompleteOpts = Parameters<AutoComplete<Result['item']>['props']['children']>[0];

type ListProps = React.ComponentProps<typeof List>;

interface InputProps extends Pick<AutoCompleteOpts, 'getInputProps'> {}

interface SearchProps extends WithRouterProps<{orgId: string}> {
  /**
   * For analytics
   */
  entryPoint: 'settings_search' | 'command_palette' | 'sidebar_help';
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
  dropdownClassName?: string;
  /**
   * Maximum number of results to display
   */
  maxResults?: number;
  /**
   * Renders the result item
   */
  renderItem?: ListProps['renderItem'];
  /**
   * Adds a footer below the results when the search is complete
   */
  resultFooter?: React.ReactNode;
  /**
   * Fuse search options
   */
  searchOptions?: Fuse.IFuseOptions<any>;
  /**
   * The sources to query
   */
  // TODO(ts): Improve any type here
  sources?: React.ComponentType<any>[];
}

function Search({
  entryPoint,
  maxResults,
  minSearch,
  renderInput,
  renderItem,
  closeOnSelect,
  dropdownClassName,
  resultFooter,
  searchOptions,
  sources,
  router,
  params,
}: SearchProps): React.ReactElement {
  useEffect(() => {
    trackAdvancedAnalyticsEvent(`${entryPoint}.open`, {
      organization: null,
    });
  }, [entryPoint]);

  const handleSelectItem = useCallback(
    (item: Result['item'], state?: AutoComplete<Result['item']>['state']) => {
      if (!item) {
        return;
      }

      trackAdvancedAnalyticsEvent(`${entryPoint}.select`, {
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

      const nextPath = replaceRouterParams(item.to, params);

      navigateTo(nextPath, router, item.configUrl);
    },
    [entryPoint, router, params]
  );

  const saveQueryMetrics = useCallback(
    (query: string) => {
      if (!query) {
        return;
      }

      trackAdvancedAnalyticsEvent(`${entryPoint}.query`, {
        query,
        organization: null,
      });
    },
    [entryPoint]
  );

  const debouncedSaveQueryMetrics = useMemo(
    () => debounce(saveQueryMetrics, 200),
    [saveQueryMetrics]
  );

  return (
    <AutoComplete
      defaultHighlightedIndex={0}
      onSelect={handleSelectItem}
      closeOnSelect={closeOnSelect ?? true}
    >
      {({getInputProps, isOpen, inputValue, ...autocompleteProps}) => {
        const searchQuery = inputValue.toLowerCase().trim();
        const isValidSearch = inputValue.length >= minSearch;

        debouncedSaveQueryMetrics(searchQuery);

        return (
          <SearchWrapper role="search">
            {renderInput({getInputProps})}

            {isValidSearch && isOpen ? (
              <SearchSources
                searchOptions={searchOptions}
                query={searchQuery}
                params={params}
                sources={
                  sources ??
                  ([
                    ApiSource,
                    FormSource,
                    RouteSource,
                    CommandSource,
                  ] as React.ComponentType[])
                }
              >
                {({isLoading, results, hasAnyResults}) => (
                  <List
                    {...{
                      isLoading,
                      results,
                      hasAnyResults,
                      maxResults,
                      resultFooter,
                      dropdownClassName,
                      renderItem,
                      ...autocompleteProps,
                    }}
                  />
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

const SearchWrapper = styled('div')`
  position: relative;
`;
