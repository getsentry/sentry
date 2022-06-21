import {useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import Fuse from 'fuse.js';

import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphSearchResult} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphSearch';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/useFlamegraphSearch';
import {
  FlamegraphFrame,
  getFlamegraphFrameSearchId,
} from 'sentry/utils/profiling/flamegraphFrame';
import {Bounds} from 'sentry/utils/profiling/gl/utils';
import {memoizeByReference} from 'sentry/utils/profiling/profile/utils';
import {isRegExpString, parseRegExp} from 'sentry/utils/profiling/validators/regExp';

type FrameSearchResults = Record<string, FlamegraphSearchResult>;

function sortFrameResults(frames: FrameSearchResults | null): Array<FlamegraphFrame> {
  // If frames have the same start times, move frames with lower stack depth first.
  // This results in top down and left to right iteration
  return Object.values(frames ?? {})
    .map(f => f.frame)
    .sort((a, b) =>
      a.start === b.start
        ? numericSort(a.depth, b.depth, 'asc')
        : numericSort(a.start, b.start, 'asc')
    );
}

const memoizedSortFrameResults = memoizeByReference(sortFrameResults);

function frameSearch(
  query: string,
  frames: ReadonlyArray<FlamegraphFrame>,
  index: Fuse<FlamegraphFrame>
): FrameSearchResults | null {
  const results: FrameSearchResults = {};
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
        if (reMatches.length > 0) {
          const frameId = getFlamegraphFrameSearchId(frame);
          results[frameId] = {
            frame,
            matchIndices: reMatches.reduce((acc, match) => {
              if (typeof match.index === 'undefined') {
                return acc;
              }

              acc.push([match.index, match.index + match[0].length]);

              return acc;
            }, [] as [number, number][]),
          };
          matches += 1;
        }
      }
    } catch (e) {
      Sentry.captureMessage(e.message);
    }

    if (matches <= 0) {
      return null;
    }

    return results;
  }

  const fuseResults = index.search(query);

  if (fuseResults.length <= 0) {
    return null;
  }

  for (let i = 0; i < fuseResults.length; i++) {
    const fuseFrameResult = fuseResults[i];
    const frame = fuseFrameResult.item;
    const frameId = getFlamegraphFrameSearchId(frame);
    results[frameId] = {
      frame,
      // matches will be defined when using 'includeMatches' in FuseOptions
      matchIndices: fuseFrameResult.matches!.reduce((acc, val) => {
        acc.push(...val.indices);
        return acc;
      }, [] as Bounds[]),
    };
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
    });
  }, [allFrames]);

  const onZoomIntoFrame = useCallback(
    (frame: FlamegraphFrame) => {
      canvasPoolManager.dispatch('zoomIntoFrame', [frame]);
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
      placeholder={t('Find Frames')}
      query={search.query}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}

const StyledSearchBar = styled(SearchBar)`
  .search-input {
    height: 28px;
  }

  flex: 1 1 100%;
`;

export {FlamegraphSearch};
