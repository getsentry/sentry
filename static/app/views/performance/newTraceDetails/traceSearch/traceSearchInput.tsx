import type React from 'react';
import {Fragment, useCallback, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {IconChevron, IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {
  TraceReducerAction,
  TraceReducerState,
} from 'sentry/views/performance/newTraceDetails/traceState';
import type {TraceSearchState} from 'sentry/views/performance/newTraceDetails/traceState/traceSearch';

interface TraceSearchInputProps {
  onTraceSearch: (
    query: string,
    node: TraceTreeNode<TraceTree.NodeValue> | null,
    behavior: 'track result' | 'persist'
  ) => void;
  trace_dispatch: React.Dispatch<TraceReducerAction>;
  trace_state: TraceReducerState;
}

const MIN_LOADING_TIME = 300;

export function TraceSearchInput(props: TraceSearchInputProps) {
  const organization = useOrganization();
  const [status, setStatus] = useState<TraceSearchState['status']>();

  const timeoutRef = useRef<number | undefined>(undefined);
  const statusRef = useRef<TraceSearchState['status']>(status);
  statusRef.current = status;

  const traceStateRef = useRef(props.trace_state);
  traceStateRef.current = props.trace_state;

  const trace_dispatch = props.trace_dispatch;
  const onTraceSearch = props.onTraceSearch;

  useLayoutEffect(() => {
    if (typeof timeoutRef.current === 'number') {
      window.clearTimeout(timeoutRef.current);
    }

    // if status is loading, show loading icon immediately
    // if previous status was loading, show loading icon for at least 500ms
    if (!statusRef.current && props.trace_state.search.status) {
      setStatus([performance.now(), props.trace_state.search.status[1]]);
      return;
    }

    const nextStatus = props.trace_state.search.status;
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
  }, [props.trace_state.search.status]);

  const onSearchFocus = useCallback(() => {
    traceAnalytics.trackSearchFocus(organization);
    if (traceStateRef.current.rovingTabIndex.node) {
      trace_dispatch({type: 'clear roving index'});
    }
  }, [trace_dispatch, organization]);

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.value) {
        trace_dispatch({type: 'clear query'});
        return;
      }

      trace_dispatch({type: 'set query', query: event.target.value});
      onTraceSearch(
        event.target.value,
        traceStateRef.current.rovingTabIndex.node ?? traceStateRef.current.search.node,
        'track result'
      );
    },
    [trace_dispatch, onTraceSearch]
  );

  const onSearchClear = useCallback(() => {
    trace_dispatch({type: 'clear query'});
  }, [trace_dispatch]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          trace_dispatch({
            type: event.shiftKey ? 'go to last match' : 'go to next match',
          });
          break;
        case 'ArrowUp':
          trace_dispatch({
            type: event.shiftKey ? 'go to first match' : 'go to previous match',
          });
          break;
        case 'Enter':
          trace_dispatch({
            type: event.shiftKey ? 'go to previous match' : 'go to next match',
          });
          break;
        default:
      }
    },
    [trace_dispatch]
  );

  const onNextSearchClick = useCallback(() => {
    if (traceStateRef.current.rovingTabIndex.node) {
      trace_dispatch({type: 'clear roving index'});
    }
    trace_dispatch({type: 'go to next match'});
  }, [trace_dispatch]);

  const onPreviousSearchClick = useCallback(() => {
    if (traceStateRef.current.rovingTabIndex.node) {
      trace_dispatch({type: 'clear roving index'});
    }
    trace_dispatch({type: 'go to previous match'});
  }, [trace_dispatch]);

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
        placeholder={t('Search in trace')}
        value={props.trace_state.search.query ?? ''}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onSearchFocus}
      />
      <InputGroup.TrailingItems>
        <StyledTrailingText data-test-id="trace-search-result-iterator">
          {`${
            props.trace_state.search.query && !props.trace_state.search.results?.length
              ? t('no results')
              : props.trace_state.search.query
                ? (props.trace_state.search.resultIteratorIndex !== null
                    ? props.trace_state.search.resultIteratorIndex + 1
                    : '-') + `/${props.trace_state.search.results?.length ?? 0}`
                : ''
          }`}
        </StyledTrailingText>
        {props.trace_state.search.query ? (
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
