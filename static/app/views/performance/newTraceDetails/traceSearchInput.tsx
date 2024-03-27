import type React from 'react';
import {useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {IconChevron, IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TraceSearchState} from 'sentry/views/performance/newTraceDetails/traceSearch';

interface TraceSearchInputProps {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onNextSearchClick: () => void;
  onPreviousSearchClick: () => void;
  onSearchClear: () => void;
  query: string | undefined;
  resultCount: number | undefined;
  resultIteratorIndex: number | null;
  status: TraceSearchState['status'];
}

const MIN_LOADING_TIME = 300;

export function TraceSearchInput(props: TraceSearchInputProps) {
  const [status, setStatus] = useState<TraceSearchState['status']>();

  const timeoutRef = useRef<number | undefined>(undefined);
  const statusRef = useRef<TraceSearchState['status']>(status);
  statusRef.current = status;

  useLayoutEffect(() => {
    if (typeof timeoutRef.current === 'number') {
      window.clearTimeout(timeoutRef.current);
    }

    // if status is loading, show loading icon immediately
    // if previous status was loading, show loading icon for at least 500ms
    if (!statusRef.current && props.status) {
      setStatus([performance.now(), props.status[1]]);
      return;
    }

    const nextStatus = props.status;
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
  }, [props.status]);

  return (
    <StyledSearchBar>
      <InputGroup.LeadingItems disablePointerEvents>
        <InvisiblePlaceholder />
        {status?.[1] === 'loading' ? (
          <StyledLoadingIndicator size={12} />
        ) : (
          <StyledSearchIcon color="subText" size={'xs'} />
        )}
      </InputGroup.LeadingItems>
      <InputGroup.Input
        size="xs"
        type="text"
        name="query"
        autoComplete="off"
        placeholder={t('Search in trace')}
        value={props.query}
        onChange={props.onChange}
        onKeyDown={props.onKeyDown}
      />
      <InputGroup.TrailingItems>
        <StyledTrailingText>
          {`${
            props.query && !props.resultCount
              ? '0/0'
              : (props.resultIteratorIndex !== null
                  ? props.resultIteratorIndex + 1
                  : '-') + `/${props.resultCount ?? 0}`
          }`}
        </StyledTrailingText>
        <StyledSearchBarTrailingButton
          size="zero"
          borderless
          icon={<IconChevron size="xs" />}
          aria-label={t('Next')}
          disabled={status?.[1] === 'loading'}
          onClick={props.onPreviousSearchClick}
        />
        <StyledSearchBarTrailingButton
          size="zero"
          borderless
          icon={<IconChevron size="xs" direction="down" />}
          aria-label={t('Previous')}
          disabled={status?.[1] === 'loading'}
          onClick={props.onNextSearchClick}
        />
        {props.query ? (
          <SearchBarTrailingButton
            size="zero"
            borderless
            disabled={status?.[1] === 'loading'}
            onClick={props.onSearchClear}
            icon={<IconClose size="xs" />}
            aria-label={t('Clear')}
          />
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
