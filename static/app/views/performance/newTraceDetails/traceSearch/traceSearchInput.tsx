import type React from 'react';
import {Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {inputStyles} from 'sentry/components/input';
import {InputGroup} from 'sentry/components/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {
  SearchQueryBuilerContext,
  type SearchQueryBuilerContextValue,
} from 'sentry/components/searchQueryBuilder/context';
import {
  useHandleSearch,
  UseHandleSearchProps,
} from 'sentry/components/searchQueryBuilder/hooks/useHandleSearch';
import {useQueryBuilderState} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {PlainTextQueryInput} from 'sentry/components/searchQueryBuilder/plainTextQueryInput';
import {TokenizedQueryGrid} from 'sentry/components/searchQueryBuilder/tokenizedQueryGrid';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {IconChevron, IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import PanelProvider from 'sentry/utils/panelProvider';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceSearchState} from 'sentry/views/performance/newTraceDetails/traceState/traceSearch';

import {useTraceState, useTraceStateDispatch} from '../traceState/traceStateProvider';

interface TraceSearchInputProps {
  onTraceSearch: (
    query: string,
    node: TraceTreeNode<TraceTree.NodeValue> | null,
    behavior: 'track result' | 'persist'
  ) => void;
}

const MIN_LOADING_TIME = 300;

function useTraceSearchInput(props: TraceSearchInputProps) {
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();
  const [status, setStatus] = useState<TraceSearchState['status']>();

  const organization = useOrganization();
  const timeoutRef = useRef<number | undefined>(undefined);
  const statusRef = useRef<TraceSearchState['status']>(status);
  statusRef.current = status;

  const traceStateRef = useRef(traceState);
  traceStateRef.current = traceState;
  const onTraceSearch = props.onTraceSearch;

  useLayoutEffect(() => {
    if (typeof timeoutRef.current === 'number') {
      window.clearTimeout(timeoutRef.current);
    }

    // if status is loading, show loading icon immediately
    // if previous status was loading, show loading icon for at least 500ms
    if (!statusRef.current && traceState.search.status) {
      setStatus([performance.now(), traceState.search.status[1]]);
      return;
    }

    const nextStatus = traceState.search.status;
    if (nextStatus) {
      const elapsed = performance.now() - nextStatus[0];
      if (elapsed > MIN_LOADING_TIME || nextStatus[1] === 'loading') {
        setStatus(nextStatus);
        return;
      }

      const schedule = nextStatus[0] + MIN_LOADING_TIME - performance.now();
      timeoutRef.current = window.setTimeout(() => {
        setStatus(nextStatus);
      }, schedule);
    } else {
      setStatus(nextStatus);
    }
  }, [traceState.search.status]);

  const onSearchFocus = useCallback(() => {
    traceAnalytics.trackSearchFocus(organization);
    if (traceStateRef.current.rovingTabIndex.node) {
      traceDispatch({type: 'clear roving index'});
    }
  }, [traceDispatch, organization]);

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.value) {
        traceDispatch({type: 'clear query'});
        return;
      }

      traceDispatch({type: 'set query', query: event.target.value});
      onTraceSearch(
        event.target.value,
        traceStateRef.current.rovingTabIndex.node ?? traceStateRef.current.search.node,
        'track result'
      );
    },
    [traceDispatch, onTraceSearch]
  );

  const onSearchClear = useCallback(() => {
    trackAnalytics('trace.trace_layout.search_clear', {
      organization,
    });
    traceDispatch({type: 'clear query'});
  }, [traceDispatch, organization]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          trackAnalytics('trace.trace_layout.search_match_navigate', {
            organization,
            direction: 'next',
            interaction: 'arrowKey',
          });
          traceDispatch({
            type: event.shiftKey ? 'go to last match' : 'go to next match',
          });
          break;
        case 'ArrowUp':
          trackAnalytics('trace.trace_layout.search_match_navigate', {
            organization,
            direction: 'prev',
            interaction: 'arrowKey',
          });
          traceDispatch({
            type: event.shiftKey ? 'go to first match' : 'go to previous match',
          });
          break;
        case 'Enter':
          trackAnalytics('trace.trace_layout.search_match_navigate', {
            organization,
            direction: event.shiftKey ? 'prev' : 'next',
            interaction: 'enterKey',
          });
          traceDispatch({
            type: event.shiftKey ? 'go to previous match' : 'go to next match',
          });
          break;
        default:
      }
    },
    [traceDispatch, organization]
  );

  const onNextSearchClick = useCallback(() => {
    trackAnalytics('trace.trace_layout.search_match_navigate', {
      organization,
      direction: 'next',
      interaction: 'click',
    });
    if (traceStateRef.current.rovingTabIndex.node) {
      traceDispatch({type: 'clear roving index'});
    }
    traceDispatch({type: 'go to next match'});
  }, [traceDispatch, organization]);

  const onPreviousSearchClick = useCallback(() => {
    trackAnalytics('trace.trace_layout.search_match_navigate', {
      organization,
      direction: 'prev',
      interaction: 'click',
    });
    if (traceStateRef.current.rovingTabIndex.node) {
      traceDispatch({type: 'clear roving index'});
    }
    traceDispatch({type: 'go to previous match'});
  }, [traceDispatch, organization]);

  return {
    onPreviousSearchClick,
    onNextSearchClick,
    onSearchFocus,
    onChange,
    onSearchClear,
    onKeyDown,
    traceState,
  };
}

function LegacyTraceSearchInput(props: TraceSearchInputProps) {
  const inputProps = useTraceSearchInput(props);

  return (
    <StyledSearchBar>
      <InputGroup.LeadingItems>
        <InvisiblePlaceholder />
        {status?.[1] === 'loading' ? (
          <StyledLoadingIndicator data-test-id="trace-search-loading" size={12} />
        ) : (
          <StyledSearchIcon
            data-test-id="trace-search-success"
            color="subText"
            size={'xs'}
          />
        )}
      </InputGroup.LeadingItems>
      <InputGroup.Input
        size="xs"
        type="text"
        name="query"
        autoComplete="off"
        placeholder={t('Search in trace...')}
        defaultValue={inputProps.traceState.search.query ?? ''}
        onChange={inputProps.onChange}
        onKeyDown={inputProps.onKeyDown}
        onFocus={inputProps.onSearchFocus}
      />
      <InputGroup.TrailingItems>
        <StyledTrailingText data-test-id="trace-search-result-iterator">
          {`${
            inputProps.traceState.search.query &&
            !inputProps.traceState.search.results?.length
              ? t('no results')
              : inputProps.traceState.search.query
                ? (inputProps.traceState.search.resultIteratorIndex !== null
                    ? inputProps.traceState.search.resultIteratorIndex + 1
                    : '-') + `/${inputProps.traceState.search.results?.length ?? 0}`
                : ''
          }`}
        </StyledTrailingText>
        {inputProps.traceState.search.query ? (
          <Fragment>
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              icon={<IconChevron size="xs" />}
              aria-label={t('Next')}
              disabled={status?.[1] === 'loading'}
              onClick={inputProps.onPreviousSearchClick}
            />
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              icon={<IconChevron size="xs" direction="down" />}
              aria-label={t('Previous')}
              disabled={status?.[1] === 'loading'}
              onClick={inputProps.onNextSearchClick}
            />
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              disabled={status?.[1] === 'loading'}
              onClick={inputProps.onSearchClear}
              icon={<IconClose size="xs" />}
              aria-label={t('Clear')}
            />
          </Fragment>
        ) : null}
      </InputGroup.TrailingItems>
    </StyledSearchBar>
  );
}

function TraceViewSearchQueryBuilderInput(props: TraceSearchInputProps) {
  const searchSource = 'trace-view';
  const traceState = useTraceState();
  const inputProps = useTraceSearchInput(props);

  const traceStateRef = useRef(traceState);
  traceStateRef.current = traceState;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  const {state, dispatch} = useQueryBuilderState({
    initialQuery: inputProps.traceState.search.query ?? '',
    getFieldDefinition,
    disabled: false,
  });

  const onTraceSearch = useCallback(
    (query: string): void => {
      props.onTraceSearch(
        query,
        traceStateRef.current.rovingTabIndex.node ?? traceStateRef.current.search.node,
        'track result'
      );
    },
    [props]
  );

  const parsedQuery = useMemo(
    () =>
      parseQueryBuilderValue(state.query, getFieldDefinition, {
        disallowFreeText: false,
        disallowLogicalOperators: false,
        disallowUnsupportedFilters: false,
        disallowWildcard: false,
        filterKeys: {},
        invalidMessages: {},
      }),
    [state.query]
  );

  const handleSearch = useHandleSearch({
    parsedQuery,
    recentSearches: undefined,
    searchSource,
    onSearch: onTraceSearch,
  });

  const {width: actionBarWidth} = useDimensions({elementRef: actionBarRef});

  const contextValue = useMemo((): SearchQueryBuilerContextValue => {
    return {
      ...state,
      disabled: false,
      parsedQuery,
      filterKeySections: [],
      filterKeyMenuWidth: 0,
      getTagValues: () => Promise.resolve([]),
      filterKeys: {},
      getFieldDefinition,
      dispatch,
      wrapperRef,
      handleSearch,
      placeholder: t('Search in trace...'),
      recentSearches: undefined,
      searchSource,
      size: 'normal',
    };
  }, [dispatch, parsedQuery, handleSearch, state]);
  useLayoutEffect(() => {
    onTraceSearch(state.query);
  }, [state.query]);
  return (
    <SearchQueryBuilerContext.Provider value={contextValue}>
      <PanelProvider>
        <Wrapper size="sm" ref={wrapperRef}>
          <PositionedSearchIcon size="sm" />
          {parsedQuery ? (
            <TokenizedQueryGrid actionBarWidth={actionBarWidth} />
          ) : (
            <PlainTextQueryInput />
          )}
        </Wrapper>
      </PanelProvider>
    </SearchQueryBuilerContext.Provider>
  );
}

export function TraceSearchInput(props: TraceSearchInputProps) {
  const organization = useOrganization();

  return true ? (
    <TraceViewSearchQueryBuilderInput {...props} />
  ) : (
    <LegacyTraceSearchInput {...props} />
  );
}

// Query builder styles
const Wrapper = styled('div')`
  ${inputStyles}
  min-height: 38px;
  padding: 0;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  cursor: text;

  :focus-within {
    border: 1px solid ${p => p.theme.focusBorder};
    box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
  }
`;
const PositionedSearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  position: absolute;
  left: ${space(1.5)};
  top: ${space(0.75)};
  height: 22px;
`;

// Old input styled
const InvisiblePlaceholder = styled('div')`
  pointer-events: none;
  visibility: hidden;
  width: 12px;
  height: 12px;
`;
const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
  left: 0;
  top: 50%;
  position: absolute;
  transform: translate(-2px, -50%);
  animation: showLoadingIndicator 0.3s ease-in-out forwards;

  @keyframes showLoadingIndicator {
    from {
      opacity: 0;
      transform: translate(-2px, -50%) scale(0.86);
    }
    to {
      opacity: 1;
      transform: translate(-2px, -50%) scale(1);
    }
  }

  .loading-indicator {
    border-width: 2px;
  }
  .loading-message {
    display: none;
  }
`;

const StyledSearchIcon = styled(IconSearch)`
  position: absolute;
  left: 0;
  top: 50%;
  transform: scale(1) translateY(-50%);
  animation: showSearchIcon 0.3s ease-in-out forwards;

  @keyframes showSearchIcon {
    from {
      opacity: 0;
      transform: scale(0.86) translateY(-50%);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(-50%);
    }
  }
`;

const StyledSearchBarTrailingButton = styled(SearchBarTrailingButton)`
  padding: 0;

  &:last-child {
    svg {
      width: 10px;
      height: 10px;
    }
  }
`;

const StyledTrailingText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledSearchBar = styled(InputGroup)`
  flex: 1 1 100%;
  margin-bottom: ${space(1)};

  > div > div:last-child {
    gap: ${space(0.25)};
  }
`;
