import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import Fuse from 'fuse.js';

import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphSearch as FlamegraphSearchResults} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphSearch';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/useFlamegraphSearch';
import {
  FlamegraphFrame,
  getFlamegraphFrameSearchId,
} from 'sentry/utils/profiling/flamegraphFrame';
import {memoizeByReference} from 'sentry/utils/profiling/profile/utils';
import {isRegExpString, parseRegExp} from 'sentry/utils/profiling/validators/regExp';

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

function findBestMatchFromFuseMatches(
  matches: ReadonlyArray<Fuse.FuseResultMatch>
): Fuse.RangeTuple | null {
  let bestMatch: Fuse.RangeTuple | null = null;
  let bestMatchLength = 0;
  let bestMatchStart = -1;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    for (let j = 0; j < match.indices.length; j++) {
      const index = match.indices[j];
      const matchLength = index[1] - index[0];

      if (matchLength < 0) {
        // Fuse sometimes returns negative indices - we will just skip them for now.
        continue;
      }

      // We only override the match if the match is longer than the current best match
      // or if the matches are the same length, but the start is earlier in the string
      if (
        matchLength > bestMatchLength ||
        (matchLength === bestMatchLength && index[0] > bestMatchStart)
      ) {
        // Offset end by 1 else we are always trailing by 1 character.
        bestMatch = [index[0], index[1] + 1];
        bestMatchLength = matchLength;
        bestMatchStart = index[0];
      }
    }
  }

  return bestMatch;
}

function findBestMatchFromRegexpMatchArray(
  matches: RegExpMatchArray[]
): Fuse.RangeTuple | null {
  let bestMatch: Fuse.RangeTuple | null = null;
  let bestMatchLength = 0;
  let bestMatchStart = -1;

  for (let i = 0; i < matches.length; i++) {
    const index = matches[i].index;
    if (index === undefined) {
      continue;
    }

    // We only override the match if the match is longer than the current best match
    // or if the matches are the same length, but the start is earlier in the string
    if (
      matches[i].length > bestMatchLength ||
      (matches[i].length === bestMatchLength && index[0] > bestMatchStart)
    ) {
      bestMatch = [index, index + matches[i].length];
      bestMatchLength = matches[i].length;
      bestMatchStart = index;
    }
  }

  return bestMatch;
}

const memoizedSortFrameResults = memoizeByReference(sortFrameResults);

function frameSearch(
  query: string,
  frames: ReadonlyArray<FlamegraphFrame>,
  index: Fuse<FlamegraphFrame>
): FlamegraphSearchResults['results'] {
  const results: FlamegraphSearchResults['results'] = new Map();

  if (isRegExpString(query)) {
    const [_, lookup, flags] = parseRegExp(query) ?? [];

    let matches = 0;

    try {
      if (!lookup) {
        throw new Error('Invalid RegExp');
      }

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];

        const re = new RegExp(lookup, flags ?? 'g');
        const reMatches = Array.from(frame.frame.name.trim().matchAll(re));

        const match = findBestMatchFromRegexpMatchArray(reMatches);

        if (match) {
          const frameId = getFlamegraphFrameSearchId(frame);
          results.set(frameId, {
            frame,
            match,
          });
          matches += 1;
        }
      }
    } catch (e) {
      Sentry.captureMessage(e.message);
    }

    if (matches <= 0) {
      return results;
    }

    return results;
  }

  const fuseResults = index.search(query);

  if (fuseResults.length <= 0) {
    return results;
  }

  for (let i = 0; i < fuseResults.length; i++) {
    const fuseFrameResult = fuseResults[i];
    const frame = fuseFrameResult.item;
    const frameId = getFlamegraphFrameSearchId(frame);
    const match = findBestMatchFromFuseMatches(fuseFrameResult.matches ?? []);

    if (match) {
      results.set(frameId, {
        frame,
        match,
      });
    }
  }

  return results;
}

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
  const [search, dispatchSearch] = useFlamegraphSearch();
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

  const searchIndex = useMemo(() => {
    return new Fuse(allFrames, {
      keys: ['frame.name'],
      threshold: 0.3,
      includeMatches: true,
      findAllMatches: true,
      ignoreLocation: true,
    });
  }, [allFrames]);

  const onZoomIntoFrame = useCallback(
    (frame: FlamegraphFrame) => {
      canvasPoolManager.dispatch('zoom at frame', [frame, 'min']);
      canvasPoolManager.dispatch('highlight frame', [frame, 'selected']);
    },
    [canvasPoolManager]
  );

  useEffect(() => {
    if (typeof search.index !== 'number') {
      return;
    }

    const frames = memoizedSortFrameResults(search.results);
    if (frames[search.index]) {
      onZoomIntoFrame(frames[search.index]);
    }
  }, [search.results, search.index, onZoomIntoFrame]);

  const handleChange: (value: string) => void = useCallback(
    value => {
      if (!value) {
        dispatchSearch({type: 'clear search'});
        return;
      }

      dispatchSearch({
        type: 'set results',
        payload: {
          results: frameSearch(value, allFrames, searchIndex),
          query: value,
        },
      });
    },
    [dispatchSearch, allFrames, searchIndex]
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
      dispatchSearch({type: 'set search index position', payload: 0});
      return;
    }

    dispatchSearch({
      type: 'set search index position',
      payload: search.index + 1,
    });
  }, [search.results, search.index, dispatchSearch]);

  const onPreviousSearchClick = useCallback(() => {
    const frames = memoizedSortFrameResults(search.results);
    if (!frames.length) {
      return;
    }

    if (search.index === null || search.index === 0) {
      dispatchSearch({
        type: 'set search index position',
        payload: frames.length - 1,
      });
      return;
    }

    dispatchSearch({
      type: 'set search index position',
      payload: search.index - 1,
    });
  }, [search.results, search.index, dispatchSearch]);

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
      query={search.query}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}

const StyledSearchBar = styled(SearchBar)`
  flex: 1 1 100%;
`;

export {FlamegraphSearch};
