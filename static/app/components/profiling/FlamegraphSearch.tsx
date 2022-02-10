import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import Fuse from 'fuse.js';

import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {isRegExpString, parseRegExp} from 'sentry/utils/profiling/validators/regExp';

function uniqueFrameKey(frame: FlamegraphFrame): string {
  return `${frame.frame.key + String(frame.start)}`;
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
  flamegraphs: Flamegraph[];
  placement: 'top' | 'bottom';
  canvasPoolManager: CanvasPoolManager;
}

function FlamegraphSearch({
  flamegraphs,
  canvasPoolManager,
}: FlamegraphSearchProps): React.ReactElement | null {
  const ref = React.useRef<HTMLInputElement>(null);

  const [open, setOpen] = React.useState<boolean>(false);
  const [selectedNode, setSelectedNode] = React.useState<FlamegraphFrame | null>();
  const [searchResults, setSearchResults] = React.useState<
    Record<string, FlamegraphFrame>
  >({});

  const allFrames = React.useMemo(() => {
    return flamegraphs.reduce(
      (acc: FlamegraphFrame[], graph) => acc.concat(graph.frames),
      []
    );
  }, [flamegraphs]);

  const searchIndex = React.useMemo(() => {
    return new Fuse(allFrames, {
      keys: ['frame.name'],
      threshold: 0.3,
      includeMatches: true,
    });
  }, [allFrames.length]);

  const onZoomIntoFrame = React.useCallback(
    (frame: FlamegraphFrame) => {
      canvasPoolManager.dispatch('zoomIntoFrame', [frame]);
      setSelectedNode(frame);
    },
    [canvasPoolManager]
  );

  const handleSearchInput = React.useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const query = evt.currentTarget.value;
      const results: Record<string, FlamegraphFrame> = {};

      if (!query) {
        setSearchResults(results);
        canvasPoolManager.dispatch('searchResults', [results]);
        return;
      }

      if (isRegExpString(query)) {
        const [_, lookup, flags] = parseRegExp(query) ?? [];

        try {
          if (!lookup) {
            throw new Error('Invalid RegExp');
          }

          const userQuery = new RegExp(lookup, flags || 'g');

          for (let i = 0; i < allFrames.length; i++) {
            const frame = allFrames[i];

            if (userQuery.test(frame.frame.name.trim())) {
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
      } else {
        const fuseResults = searchIndex
          .search(query)
          .sort((a, b) => numericSort(a.item.start, b.item.start, 'asc'));

        for (const frame of fuseResults) {
          results[
            `${
              frame.item.frame.name +
              (frame.item.frame.file ? frame.item.frame.file : '') +
              String(frame.item.start)
            }`
          ] = frame.item;
        }
      }

      setSearchResults(results);
      canvasPoolManager.dispatch('searchResults', [results]);
    },
    [searchIndex, frames, canvasPoolManager]
  );

  const onNextSearchClick = React.useCallback(() => {
    const frames = Object.values(searchResults).sort((a, b) =>
      a.start === b.start
        ? numericSort(a.depth, b.depth, 'asc')
        : numericSort(a.start, b.start, 'asc')
    );
    if (!frames.length) {
      return undefined;
    }

    if (!selectedNode) {
      return onZoomIntoFrame(frames[0] ?? null);
    }

    const index = frames.findIndex(
      f => uniqueFrameKey(f) === uniqueFrameKey(selectedNode)
    );

    if (index + 1 > frames.length - 1) {
      return onZoomIntoFrame(frames[0]);
    }
    return onZoomIntoFrame(frames[index + 1]);
  }, [selectedNode, searchResults, onZoomIntoFrame]);

  const onPreviousSearchClick = React.useCallback(() => {
    const frames = Object.values(searchResults).sort((a, b) =>
      a.start === b.start
        ? numericSort(a.depth, b.depth, 'asc')
        : numericSort(a.start, b.start, 'asc')
    );
    if (!frames.length) {
      return undefined;
    }

    if (!selectedNode) {
      return onZoomIntoFrame(frames[0] ?? null);
    }
    const index = frames.findIndex(
      f => uniqueFrameKey(f) === uniqueFrameKey(selectedNode)
    );

    if (index - 1 < 0) {
      return onZoomIntoFrame(frames[frames.length - 1]);
    }
    return onZoomIntoFrame(frames[index - 1]);
  }, [selectedNode, searchResults, onZoomIntoFrame]);

  const onCmdF = React.useCallback(
    (evt: KeyboardEvent) => {
      if (evt.key === 'f' && evt.metaKey) {
        evt.preventDefault();
        if (open) {
          ref.current?.focus();
        } else {
          setOpen(true);
        }
      }
      if (evt.key === 'Escape') {
        setSearchResults({});
        setOpen(false);
      }
    },
    [open, setSearchResults]
  );

  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'Escape') {
        setSearchResults({});
        setOpen(false);
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
    [onNextSearchClick, onPreviousSearchClick, setSearchResults]
  );

  React.useEffect(() => {
    document.addEventListener('keydown', onCmdF);

    return () => {
      document.removeEventListener('keydown', onCmdF);
    };
  }, [onCmdF]);

  return open ? (
    <Input
      ref={ref}
      autoFocus
      type="text"
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
