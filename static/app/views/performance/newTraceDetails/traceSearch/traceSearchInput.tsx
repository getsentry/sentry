import type React from 'react';
import {Fragment, useCallback, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {IconChevron, IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DispatchingReducerMiddleware} from 'sentry/utils/useDispatchingReducer';
import useOrganization from 'sentry/utils/useOrganization';

import {traceAnalytics} from '../traceAnalytics';
import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import type {TraceReducer} from '../traceState';
import type {TraceSearchState} from '../traceState/traceSearch';
import {
  useTraceState,
  useTraceStateDispatch,
  useTraceStateEmitter,
} from '../traceState/traceStateProvider';

interface TraceSearchInputProps {
  onTraceSearch: (
    query: string,
    node: TraceTreeNode<TraceTree.NodeValue> | null,
    behavior: 'track result' | 'persist'
  ) => void;
  organization: Organization;
}

const MIN_LOADING_TIME = 300;

export function TraceSearchInput(props: TraceSearchInputProps) {
  const organization = useOrganization();
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();
  const traceStateEmitter = useTraceStateEmitter();
  const [status, setStatus] = useState<TraceSearchState['status']>([0, 'success']);

  const timeoutRef = useRef<number | undefined>(undefined);
  const statusRef = useRef<TraceSearchState['status']>(status);
  statusRef.current = status;

  const traceStateRef = useRef(traceState);
  traceStateRef.current = traceState;
  const onTraceSearch = props.onTraceSearch;

  useLayoutEffect(() => {
    if (typeof timeoutRef.current === 'number') {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    // if status is loading, show loading icon immediately
    // if previous status was loading, show loading icon for at least 500ms
    if (!statusRef.current && traceState.search.status) {
      setStatus([performance.now(), traceState.search.status[1]]);
      return undefined;
    }

    let cancel = false;

    const nextStatus = traceState.search.status;
    if (nextStatus) {
      const elapsed = performance.now() - nextStatus[0];
      if (elapsed > MIN_LOADING_TIME || nextStatus[1] === 'loading') {
        setStatus(nextStatus);
        return undefined;
      }

      const schedule = nextStatus[0] + MIN_LOADING_TIME - performance.now();
      timeoutRef.current = window.setTimeout(() => {
        if (!cancel) {
          setStatus(nextStatus);
        }
      }, schedule);
    } else {
      setStatus(nextStatus);
    }

    return () => {
      cancel = true;
    };
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

  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const beforeTraceNextStateDispatch: DispatchingReducerMiddleware<
      typeof TraceReducer
    >['before next state'] = (_prevState, _nextState, action) => {
      if (
        action.type === 'set query' &&
        action.source === 'external' &&
        action.query &&
        inputRef.current
      ) {
        inputRef.current.value = action.query;
        traceDispatch({type: 'clear roving index'});
        onTraceSearch(action.query, traceStateRef.current.search.node, 'track result');
      }
    };

    traceStateEmitter.on('before next state', beforeTraceNextStateDispatch);

    return () => {
      traceStateEmitter.off('before next state', beforeTraceNextStateDispatch);
    };
  }, [traceStateEmitter, onTraceSearch, traceDispatch]);

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
        ref={inputRef}
        size="xs"
        type="text"
        name="query"
        autoComplete="off"
        placeholder={t('Search in trace')}
        defaultValue={traceState.search.query}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onSearchFocus}
      />
      <InputGroup.TrailingItems>
        <StyledTrailingText data-test-id="trace-search-result-iterator">
          {`${
            traceState.search.query && !traceState.search.results?.length
              ? t('no results')
              : traceState.search.query
                ? (traceState.search.resultIteratorIndex !== null
                    ? traceState.search.resultIteratorIndex + 1
                    : '-') + `/${traceState.search.results?.length ?? 0}`
                : ''
          }`}
        </StyledTrailingText>
        {traceState.search.query ? (
          <Fragment>
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              icon={<IconChevron size="xs" />}
              aria-label={t('Next')}
              disabled={status?.[1] === 'loading'}
              onClick={onPreviousSearchClick}
            />
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              icon={<IconChevron size="xs" direction="down" />}
              aria-label={t('Previous')}
              disabled={status?.[1] === 'loading'}
              onClick={onNextSearchClick}
            />
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              disabled={status?.[1] === 'loading'}
              onClick={onSearchClear}
              icon={<IconClose size="xs" />}
              aria-label={t('Clear')}
            />
          </Fragment>
        ) : null}
      </InputGroup.TrailingItems>
    </StyledSearchBar>
  );
}

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
