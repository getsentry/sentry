import {Fragment, useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import SearchBar, {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {parseRegExp} from 'sentry/utils/profiling/validators/regExp';

function isFlamegraphFrame(
  frame: FlamegraphFrame | SpanChartNode
): frame is FlamegraphFrame {
  return 'frame' in frame;
}

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
    match: match.matches,
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
    match: match.matches,
  });
  return match;
}

export function searchFrameRegExp(
  frame: FlamegraphFrame,
  matches: FlamegraphSearchResults['results']['frames'],
  query: string,
  flags: string
) {
  const regExp = new RegExp(query, flags || 'g');
  const stringMatches = frame.frame.name.matchAll(regExp);

  if (!stringMatches) {
    return null;
  }

  const match = findBestMatchFromRegexpMatchArray(stringMatches);

  if (!match) {
    return match;
  }

  matches.set(getFlamegraphFrameSearchId(frame), {
    frame,
    match: [match],
  });
  return match;
}

export function searchSpanRegExp(
  span: SpanChartNode,
  matches: FlamegraphSearchResults['results']['spans'],
  query: string,
  flags: string
) {
  const regExp = new RegExp(query, flags || 'g');
  const stringMatches = span.text.matchAll(regExp);

  if (!stringMatches) {
    return null;
  }

  const match = findBestMatchFromRegexpMatchArray(stringMatches);

  if (!match) {
    return match;
  }

  matches.set(span.node.span.span_id, {
    span,
    match: [match],
  });
  return match;
}

function findBestMatchFromRegexpMatchArray(
  matches: IterableIterator<RegExpMatchArray>
): [number, number] | null {
  let bestMatch: [number, number] | null = null;
  let bestMatchLength = 0;
  let bestMatchStart = -1;

  for (const match of matches) {
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

  const forcedGlobalFlags = flags && flags.includes('g') ? flags : (flags || '') + 'g';

  const searchFramesFunction = isRegExpSearch ? searchFrameRegExp : searchFrameFzf;
  const searchSpansFunction = isRegExpSearch ? searchSpanRegExp : searchSpanFzf;
  const searchQuery = isRegExpSearch ? lookup : lowercaseQuery;

  function searchFramesAndSpans() {
    const start = performance.now();

    while (processedSpans < spansToProcess && performance.now() - start < budget) {
      searchSpansFunction(
        spans[processedSpans]!,
        results.spans,
        searchQuery,
        forcedGlobalFlags
      );
      processedSpans++;
    }

    while (processedFrames < framesToProcess && performance.now() - start < budget) {
      searchFramesFunction(
        frames[processedFrames]!,
        results.frames,
        searchQuery,
        forcedGlobalFlags
      );
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

function sortByDepthAndStart(
  a: FlamegraphFrame | SpanChartNode,
  b: FlamegraphFrame | SpanChartNode
) {
  return a.start === b.start
    ? numericSort(a.depth, b.depth, 'asc')
    : numericSort(a.start, b.start, 'asc');
}

function sortFrameResults(
  results: FlamegraphSearchResults['results']
): Array<FlamegraphFrame | SpanChartNode> {
  // If frames have the same start times, move frames with lower stack depth first.
  // This results in top down and left to right iteration
  let sid = -1;
  const spans: Array<SpanChartNode | FlamegraphFrame> = new Array(results.frames.size);
  for (const n of results.spans.values()) {
    spans[++sid] = n.span;
  }

  let fid = -1;
  const frames: Array<FlamegraphFrame> = new Array(results.frames.size);
  for (const n of results.frames.values()) {
    frames[++fid] = n.frame;
  }
  spans.sort(sortByDepthAndStart);
  frames.sort(sortByDepthAndStart);

  return spans.concat(frames);
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

  const onZoomIntoSpan = useCallback(
    (span: SpanChartNode) => {
      canvasPoolManager.dispatch('zoom at span', [span, 'min']);
      canvasPoolManager.dispatch('highlight span', [[span], 'selected']);
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
      if (isFlamegraphFrame(frame)) {
        onZoomIntoFrame(frame);
      } else {
        onZoomIntoSpan(frame);
      }
    }
  }, [search.results, search.index, onZoomIntoFrame, onZoomIntoSpan]);

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
            type: 'set search results',
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
    if (allFlamegraphFrames.length === 0) {
      return;
    }

    if (!search.query) {
      return;
    }

    handleChange(search.query);
    // Dont fire on query changes, we just want this to fire on initial load
    // as the spans and frames eventually get loaded into the view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleChange, allFlamegraphFrames, spans]);

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
        search.query ? (
          <Fragment>
            <StyledTrailingText>
              {`${
                search.index !== null && search.results.frames.size > 0
                  ? search.index + 1
                  : '-'
              }/${search.results.frames.size + search.results.spans.size}`}
            </StyledTrailingText>
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              icon={<IconChevron size="xs" />}
              aria-label={t('Next')}
              onClick={onPreviousSearchClick}
            />
            <StyledSearchBarTrailingButton
              size="zero"
              borderless
              icon={<IconChevron size="xs" direction="down" />}
              aria-label={t('Previous')}
              onClick={onNextSearchClick}
            />
          </Fragment>
        ) : (
          <Tooltip title={t(`Also supports regular expressions, e.g. /^functionName/i`)}>
            <StyledIconInfo size="xs" color="gray300" />
          </Tooltip>
        )
      }
    />
  );
}

const StyledIconInfo = styled(IconInfo)`
  transform: translateY(1px);
`;

const StyledSearchBarTrailingButton = styled(SearchBarTrailingButton)`
  padding: 0;
`;

const StyledTrailingText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1 1 100%;

  > div > div:last-child {
    gap: ${space(0.25)};
  }
`;

export {FlamegraphSearch};
