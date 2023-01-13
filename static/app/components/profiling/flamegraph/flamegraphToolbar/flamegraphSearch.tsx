import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import SearchBar, {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphSearch as FlamegraphSearchResults} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphSearch';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {getFlamegraphFrameSearchId} from 'sentry/utils/profiling/flamegraphFrame';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {memoizeByReference} from 'sentry/utils/profiling/profile/utils';
import type {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {parseRegExp} from 'sentry/utils/profiling/validators/regExp';

export function searchFrameFzf(
  frame: FlamegraphFrame,
  matches: FlamegraphSearchResults['results']['frames'],
  query: string
) {
  const match = fzf(frame.frame.name, query, false);

  if (match.score <= 0) {
    return match;
  }

  matches.set(getFlamegraphFrameSearchId(frame), {
    frame,
    match: match.matches[0],
  });
  return match;
}

export function searchSpanFzf(
  span: SpanChartNode,
  matches: FlamegraphSearchResults['results']['spans'],
  query: string
) {
  const match = fzf(span.text ?? '', query, false);

  if (match.score <= 0) {
    return match;
  }

  matches.set(span.node.span.span_id, {
    span,
    match: match.matches[0],
  });
  return match;
}

export function searchFrameRegExp(
  frame: FlamegraphFrame,
  matches: FlamegraphSearchResults['results']['frames'],
  query: string,
  flags: string
) {
  const regExp = new RegExp(query, flags ?? 'g');
  const reMatches = Array.from(frame.frame.name.matchAll(regExp));
  const match = findBestMatchFromRegexpMatchArray(reMatches);

  if (match === null) {
    return match;
  }

  matches.set(getFlamegraphFrameSearchId(frame), {
    frame,
    match,
  });
  return match;
}

export function searchSpanRegExp(
  span: SpanChartNode,
  matches: FlamegraphSearchResults['results']['spans'],
  query: string,
  flags: string
) {
  const regExp = new RegExp(query, flags ?? 'g');
  const reMatches = Array.from(span.text.matchAll(regExp));
  const match = findBestMatchFromRegexpMatchArray(reMatches);

  if (match === null) {
    return match;
  }

  matches.set(span.node.span.span_id, {
    span,
    match,
  });
  return match;
}

function yieldingRafFrameSearch(
  query: string,
  spans: ReadonlyArray<SpanChartNode>,
  frames: ReadonlyArray<FlamegraphFrame>,
  cb: (results: FlamegraphSearchResults['results']) => void
) {
  const raf = {id: 0};
  const budget = 12; // ms
  const results: FlamegraphSearchResults['results'] = {
    frames: new Map(),
    spans: new Map(),
  };
  const regexp = parseRegExp(query);
  const isRegExpSearch = regexp !== null;

  let processedFrames = 0;
  let processedSpans = 0;

  const framesToProcess = frames.length;
  const spansToProcess = spans.length;

  // we lowercase the query to make the search case insensitive (assumption of fzf)
  const lowercaseQuery = query.toLowerCase();
  const [_, lookup, flags] = isRegExpSearch ? regexp : ['', '', ''];

  const searchFramesFunction = isRegExpSearch ? searchFrameRegExp : searchFrameFzf;
  const searchSpansFunction = isRegExpSearch ? searchSpanRegExp : searchSpanFzf;
  const searchQuery = isRegExpSearch ? lookup : lowercaseQuery;

  function searchFramesAndSpans() {
    const start = performance.now();

    while (processedSpans < spansToProcess && performance.now() - start < budget) {
      searchSpansFunction(spans[processedSpans]!, results.spans, searchQuery, flags);
      processedSpans++;
    }

    while (processedFrames < framesToProcess && performance.now() - start < budget) {
      searchFramesFunction(frames[processedFrames]!, results.frames, searchQuery, flags);
      processedFrames++;
    }

    if (processedFrames === framesToProcess && processedSpans === spansToProcess) {
      cb(results);
      return;
    }

    if (processedFrames < framesToProcess || processedSpans < spansToProcess) {
      raf.id = requestAnimationFrame(searchFramesAndSpans);
    }
  }

  raf.id = requestAnimationFrame(searchFramesAndSpans);
  return raf;
}

function sortFrameResults(
  frames: FlamegraphSearchResults['results']
): Array<FlamegraphFrame> {
  // If frames have the same start times, move frames with lower stack depth first.
  // This results in top down and left to right iteration
  return [...frames.frames.values()]
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
    const match = matches[i]!; // iterating over a non empty array
    const index = match.index;
    if (index === undefined) {
      continue;
    }
    const length = match[0].length;

    // We only override the match if the match is longer than the current best match
    // or if the matches are the same length, but the start is earlier in the string
    if (
      length > bestMatchLength ||
      (length === bestMatchLength && index < bestMatchStart)
    ) {
      bestMatch = [index, index + length];
      bestMatchLength = length;
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
  spans: SpanChart | SpanChart[];
}

function FlamegraphSearch({
  flamegraphs,
  canvasPoolManager,
  spans,
}: FlamegraphSearchProps): React.ReactElement | null {
  const search = useFlamegraphSearch();
  const dispatch = useDispatchFlamegraphState();
  const [didInitialSearch, setDidInitialSearch] = useState(!search.query);

  const allFlamegraphFrames = useMemo(() => {
    if (Array.isArray(flamegraphs)) {
      return flamegraphs.reduce(
        (acc: FlamegraphFrame[], graph) => acc.concat(graph.frames),
        []
      );
    }

    return flamegraphs.frames;
  }, [flamegraphs]);

  const allSpanChartNodes = useMemo(() => {
    if (Array.isArray(spans)) {
      return spans.reduce((acc: SpanChartNode[], span) => acc.concat(span.spans), []);
    }

    return spans.spans;
  }, [spans]);

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

      rafHandler.current = yieldingRafFrameSearch(
        query,
        allSpanChartNodes,
        allFlamegraphFrames,
        results => {
          dispatch({
            type: 'set results',
            payload: {
              results,
              query,
            },
          });
        }
      );
    },
    [dispatch, allFlamegraphFrames, allSpanChartNodes]
  );

  useEffect(() => {
    if (didInitialSearch || allFlamegraphFrames.length === 0) {
      return;
    }
    handleChange(search.query);
    setDidInitialSearch(true);
  }, [didInitialSearch, handleChange, allFlamegraphFrames, search.query]);

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
                search.index !== null && search.results.frames.size > 0
                  ? search.index + 1
                  : '-'
              }/${search.results.frames.size}`}
            </StyledTrailingText>
            <SearchBarTrailingButton
              size="zero"
              borderless
              icon={<IconChevron size="xs" />}
              aria-label={t('Next')}
              onClick={onPreviousSearchClick}
            />
            <SearchBarTrailingButton
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
