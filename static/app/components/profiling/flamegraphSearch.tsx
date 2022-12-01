import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import SearchBar, {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphSearch as FlamegraphSearchResults} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphSearch';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {
  FlamegraphFrame,
  getFlamegraphFrameSearchId,
} from 'sentry/utils/profiling/flamegraphFrame';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {memoizeByReference} from 'sentry/utils/profiling/profile/utils';
import {isRegExpString, parseRegExp} from 'sentry/utils/profiling/validators/regExp';

function yieldingRafFrameSearch(
  query: string,
  frames: ReadonlyArray<FlamegraphFrame>,
  cb: (results: FlamegraphSearchResults['results']) => void
) {
  const raf = {id: 0};
  const budget = 12; // ms
  const results: FlamegraphSearchResults['results'] = new Map();
  const isRegExpSearch = isRegExpString(query);
  const [_, lookup, flags] = parseRegExp(query) ?? [];
  // we lowercase the query to make the search case insensitive (assumption of fzf)
  const lowercaseQuery = query.toLowerCase();
  let processed = 0;

  function work() {
    const start = performance.now();

    while (performance.now() - start < budget && processed < frames.length) {
      const frame = frames[processed]!;

      if (!isRegExpSearch) {
        const match = fzf(frame.frame.name, lowercaseQuery, false);

        if (match.score > 0) {
          results.set(getFlamegraphFrameSearchId(frame), {
            frame,
            match: match.matches[0],
          });
        }
      } else {
        for (let i = start; i < frames.length; i++) {
          const re = new RegExp(lookup, flags ?? 'g');
          const reMatches = Array.from(frame.frame.name.trim().matchAll(re));
          const match = findBestMatchFromRegexpMatchArray(reMatches);

          if (match) {
            const frameId = getFlamegraphFrameSearchId(frame);
            results.set(frameId, {
              frame,
              match,
            });
          }
        }
      }

      processed++;
    }

    if (processed === frames.length) {
      cb(results);
    }
    if (processed < frames.length) {
      raf.id = requestAnimationFrame(work);
    }
  }

  raf.id = requestAnimationFrame(work);
  return raf;
}

function sortFrameResults(
  frames: FlamegraphSearchResults['results']
): Array<FlamegraphFrame> {
  // If frames have the same start times, move frames with lower stack depth first.
  // This results in top down and left to right iteration
  return [...frames.values()]
    .map(f => f.frame)
    .sort((a, b) =>
      a.start === b.start
        ? numericSort(a.depth, b.depth, 'asc')
        : numericSort(a.start, b.start, 'asc')
    );
}

function findBestMatchFromRegexpMatchArray(
  matches: RegExpMatchArray[]
): [number, number] | null {
  let bestMatch: [number, number] | null = null;
  let bestMatchLength = 0;
  let bestMatchStart = -1;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]; // iterating over a non empty array
    if (match === undefined) {
      continue;
    }

    const index = match.index;
    if (index === undefined) {
      continue;
    }

    // We only override the match if the match is longer than the current best match
    // or if the matches are the same length, but the start is earlier in the string
    if (
      match.length > bestMatchLength ||
      (match.length === bestMatchLength && index[0] > bestMatchStart)
    ) {
      bestMatch = [index, index + match.length];
      bestMatchLength = match.length;
      bestMatchStart = index;
    }
  }

  return bestMatch;
}

const memoizedSortFrameResults = memoizeByReference(sortFrameResults);
const numericSort = (
  a: null | undefined | number,
  b: null | undefined | number,
  direction: 'asc' | 'desc'
): number => {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return 1;
  }
  if (b === null || b === undefined) {
    return -1;
  }

  return direction === 'asc' ? a - b : b - a;
};

interface FlamegraphSearchProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphs: Flamegraph | Flamegraph[];
}

function FlamegraphSearch({
  flamegraphs,
  canvasPoolManager,
}: FlamegraphSearchProps): React.ReactElement | null {
  const search = useFlamegraphSearch();
  const dispatch = useDispatchFlamegraphState();
  const [didInitialSearch, setDidInitialSearch] = useState(!search.query);

  const allFrames = useMemo(() => {
    if (Array.isArray(flamegraphs)) {
      return flamegraphs.reduce(
        (acc: FlamegraphFrame[], graph) => acc.concat(graph.frames),
        []
      );
    }

    return flamegraphs.frames;
  }, [flamegraphs]);

  const onZoomIntoFrame = useCallback(
    (frame: FlamegraphFrame) => {
      canvasPoolManager.dispatch('zoom at frame', [frame, 'min']);
      canvasPoolManager.dispatch('highlight frame', [[frame], 'selected']);
    },
    [canvasPoolManager]
  );

  useEffect(() => {
    if (typeof search.index !== 'number') {
      return;
    }

    const frames = memoizedSortFrameResults(search.results);
    const frame = frames[search.index];
    if (frame) {
      onZoomIntoFrame(frame);
    }
  }, [search.results, search.index, onZoomIntoFrame]);

  const rafHandler = useRef<ReturnType<typeof yieldingRafFrameSearch> | null>(null);

  const handleChange: (query: string) => void = useCallback(
    query => {
      if (rafHandler.current) {
        window.cancelAnimationFrame(rafHandler.current.id);
      }

      if (!query) {
        dispatch({type: 'clear search'});
        return;
      }

      rafHandler.current = yieldingRafFrameSearch(query, allFrames, results => {
        dispatch({
          type: 'set results',
          payload: {
            results,
            query,
          },
        });
      });
    },
    [dispatch, allFrames]
  );

  useEffect(() => {
    if (didInitialSearch || allFrames.length === 0) {
      return;
    }
    handleChange(search.query);
    setDidInitialSearch(true);
  }, [didInitialSearch, handleChange, allFrames, search.query]);

  const onNextSearchClick = useCallback(() => {
    const frames = memoizedSortFrameResults(search.results);
    if (!frames.length) {
      return;
    }

    if (search.index === null || search.index === frames.length - 1) {
      dispatch({type: 'set search index position', payload: 0});
      return;
    }

    dispatch({
      type: 'set search index position',
      payload: search.index + 1,
    });
  }, [search.results, search.index, dispatch]);

  const onPreviousSearchClick = useCallback(() => {
    const frames = memoizedSortFrameResults(search.results);
    if (!frames.length) {
      return;
    }

    if (search.index === null || search.index === 0) {
      dispatch({
        type: 'set search index position',
        payload: frames.length - 1,
      });
      return;
    }

    dispatch({
      type: 'set search index position',
      payload: search.index - 1,
    });
  }, [search.results, search.index, dispatch]);

  const handleKeyDown = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        onNextSearchClick();
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        onPreviousSearchClick();
      }
    },
    [onNextSearchClick, onPreviousSearchClick]
  );

  return (
    <StyledSearchBar
      size="xs"
      placeholder={t('Find Frames')}
      defaultQuery={search.query}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      trailing={
        search.query && (
          <Fragment>
            <StyledTrailingText>
              {`${
                search.index !== null && search.results.size > 0 ? search.index + 1 : '-'
              }/${search.results.size}`}
            </StyledTrailingText>
            <SearchBarTrailingButton
              type="button"
              size="zero"
              borderless
              icon={<IconChevron size="xs" />}
              aria-label={t('Next')}
              onClick={onPreviousSearchClick}
            />
            <SearchBarTrailingButton
              type="button"
              size="zero"
              borderless
              icon={<IconChevron size="xs" direction="down" />}
              aria-label={t('Previous')}
              onClick={onNextSearchClick}
            />
          </Fragment>
        )
      }
    />
  );
}

const StyledTrailingText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1 1 100%;
`;

export {FlamegraphSearch};
