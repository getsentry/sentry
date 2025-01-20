import {useCallback, useEffect, useMemo} from 'react';
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
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';

import type {Result} from './sources/types';
import List from './list';

type AutoCompleteOpts = Parameters<AutoComplete<Result['item']>['props']['children']>[0];

type ListProps = React.ComponentProps<typeof List>;

interface InputProps extends Pick<AutoCompleteOpts, 'getInputProps'> {}

interface SearchProps {
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
}: SearchProps): React.ReactElement {
  const router = useRouter();

  const params = useParams<{orgId: string}>();
  useEffect(() => {
    trackAnalytics(`${entryPoint}.open`, {
      organization: null,
    });
  }, [entryPoint]);

  const handleSelectItem = useCallback(
    (item: Readonly<Result['item']>, state?: AutoComplete<Result['item']>['state']) => {
      if (!item) {
        return;
      }

      trackAnalytics(`${entryPoint}.select`, {
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

      const pathname = typeof item.to === 'string' ? item.to : item.to.pathname;
      if (pathname.startsWith('http')) {
        const open = window.open();

        if (open) {
          open.opener = null;
          // `to` is a full URL when starting with http
          open.location.href = item.to as string;
          return;
        }

        addErrorMessage(
          t('Unable to open search result (a popup blocker may have caused this).')
        );
        return;
      }

      const nextTo =
        typeof item.to === 'string'
          ? replaceRouterParams(item.to, params)
          : {
              ...item.to,
              pathname: replaceRouterParams(item.to.pathname, params),
            };
      navigateTo(nextTo, router, item.configUrl);
    },
    [entryPoint, router, params]
  );

  const saveQueryMetrics = useCallback(
    (query: string) => {
      if (!query) {
        return;
      }

      trackAnalytics(`${entryPoint}.query`, {
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
      isOpen
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
                sources={sources ?? [ApiSource, FormSource, RouteSource, CommandSource]}
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

export type {SearchProps};
export {Search};

const SearchWrapper = styled('div')`
  position: relative;
`;
