import {useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import Fuse from 'fuse.js';

import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/useFlamegraphSearch';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {memoizeByReference} from 'sentry/utils/profiling/profile/utils';
import {isRegExpString, parseRegExp} from 'sentry/utils/profiling/validators/regExp';

function sortFrameResults(
  frames: Record<string, FlamegraphFrame> | null
): Array<FlamegraphFrame> {
  // If frames have the same start times, move frames with lower stack depth first.
  // This results in top down and left to right iteration
  return Object.values(frames ?? {}).sort((a, b) =>
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
): Record<string, FlamegraphFrame> {
  const results = {};
  if (isRegExpString(query)) {
    const [_, lookup, flags] = parseRegExp(query) ?? [];

    try {
      if (!lookup) {
        throw new Error('Invalid RegExp');
      }

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];

        if (new RegExp(lookup, flags ?? 'g').test(frame.frame.name.trim())) {
          results[
            `${
              frame.frame.name +
              (frame.frame.file ? frame.frame.file : '') +
              String(frame.start)
            }`
          ] = frame;
        }
      }
    } catch (e) {
      Sentry.captureMessage(e.message);
    }

    return results;
  }

  const fuseResults = index.search(query);

  for (let i = 0; i < fuseResults.length; i++) {
    const frame = fuseResults[i];

    results[
      `${
        frame.item.frame.name +
        (frame.item.frame.file ? frame.item.frame.file : '') +
        String(frame.item.start)
      }`
    ] = frame.item;
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
  placement: 'top' | 'bottom';
}

function FlamegraphSearch({
  flamegraphs,
  canvasPoolManager,
}: FlamegraphSearchProps): React.ReactElement | null {
  const ref = useRef<HTMLInputElement>(null);

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
  }, [search.results, search.index]);

  const handleSearchInput = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      if (!evt.currentTarget.value) {
        dispatchSearch({type: 'clear search', payload: {open: true}});
        return;
      }

      dispatchSearch({
        type: 'set results',
        payload: {
          results: frameSearch(evt.currentTarget.value, allFrames, searchIndex),
          query: evt.currentTarget.value,
        },
      });
    },
    [searchIndex, frames, canvasPoolManager, allFrames]
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
  }, [search.results, search.index]);

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
  }, [search.results, search.index]);

  const onCmdF = useCallback(
    (evt: KeyboardEvent) => {
      if (evt.key === 'f' && evt.metaKey) {
        evt.preventDefault();
        if (search.open) {
          ref.current?.focus();
        } else {
          dispatchSearch({type: 'open search'});
        }
        return;
      }
      if (evt.key === 'Escape') {
        dispatchSearch({type: 'clear search'});
      }
    },
    [search.open]
  );

  const onKeyDown = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'Escape') {
        dispatchSearch({type: 'clear search'});
      }
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        onNextSearchClick();
      }
      if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        onPreviousSearchClick();
      }
    },
    [onNextSearchClick, onPreviousSearchClick]
  );

  useEffect(() => {
    document.addEventListener('keydown', onCmdF);

    return () => {
      document.removeEventListener('keydown', onCmdF);
    };
  }, [onCmdF]);

  return search.open ? (
    <Input
      ref={ref}
      autoFocus
      type="text"
      value={search.query}
      onChange={handleSearchInput}
      onKeyDown={onKeyDown}
    />
  ) : null;
}

const Input = styled('input')`
  position: absolute;
  left: 50%;
  top: ${space(4)};
  transform: translateX(-50%);
`;

export {FlamegraphSearch};
