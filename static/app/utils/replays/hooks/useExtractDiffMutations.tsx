import formatDuration from 'sentry/utils/duration/formatDuration';
import {useQuery, type UseQueryResult} from 'sentry/utils/queryClient';
import replayerStepper from 'sentry/utils/replays/replayerStepper';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {
  EventType,
  IncrementalSource,
  isRRWebChangeFrame,
  type RecordingFrame,
  type ReplayFrame,
} from 'sentry/utils/replays/types';

type DiffMutation = Record<
  number,
  {
    adds: Record<string, unknown>;
    attributes: Record<string, unknown>;
    offset: number;
    removes: Record<string, unknown>;
    timestamp: number;
  }
>;

type Args = {
  rangeEndTimestampMs: number;
  rangeStartTimestampMs: number;
  replay: ReplayReader;
};

async function extractDiffMutations({
  rangeEndTimestampMs,
  rangeStartTimestampMs,
  replay,
}: Args): Promise<Map<RecordingFrame, DiffMutation>> {
  let hasStartedVisiting = false;
  let hasFinishedVisiting = false;
  let lastFrame: null | RecordingFrame = null;

  const startTimestampMs = replay.getReplay().started_at.getTime() ?? 0;

  const results = await replayerStepper<RecordingFrame, DiffMutation>({
    frames: replay.getRRWebFrames(),
    rrwebEvents: replay.getRRWebFrames(),
    startTimestampMs,
    shouldVisitFrame: (frame, _replayer) => {
      const isWithinRange =
        rangeStartTimestampMs < frame.timestamp && frame.timestamp <= rangeEndTimestampMs;

      // within the range, so we visit.
      if (isWithinRange) {
        hasStartedVisiting = true;
        return isRRWebChangeFrame(frame);
      }
      // if we started, but didn't record that visiting is finished, then this
      // is the first frame outside of the range. we'll visit it, so we can
      // consume the lastFrame, but afterwards no more visits will happen.
      if (hasStartedVisiting && !hasFinishedVisiting) {
        hasFinishedVisiting = true;
        return true;
      }
      // we either haven't started, or we already finished, not need to visit.
      return false;
    },
    onVisitFrame: (frame, collection, replayer) => {
      const mirror = replayer.getMirror();
      if (lastFrame && lastFrame.type === EventType.FullSnapshot) {
        const node = mirror.getNode(lastFrame.data.node.id) as Document | null;
        const item = collection.get(lastFrame);
        if (node && item) {
          const formattedTimestamp = formatDuration({
            duration: [Math.abs(lastFrame.timestamp - startTimestampMs), 'ms'],
            precision: 'ms',
            style: 'hh:mm:ss.sss',
          });
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          item[formattedTimestamp].adds = {
            document: {
              html: node?.documentElement?.outerHTML,
            },
          };
        }
      } else if (
        lastFrame &&
        lastFrame.type === EventType.IncrementalSnapshot &&
        'source' in lastFrame.data &&
        lastFrame.data.source === IncrementalSource.Mutation
      ) {
        const adds = {};
        for (const add of lastFrame.data.adds) {
          const node = mirror.getNode(add.node.id) as HTMLElement | null;
          if (!node || !node.outerHTML) {
            continue;
          }
          const selector = getSelectorForElem(node);
          const rootIsAdded = Object.keys(adds).some(key => selector.startsWith(key));
          if (rootIsAdded) {
            continue;
          }

          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          adds[selector] = {
            document: node.outerHTML,
          };
        }

        const attributes = {};
        for (const attr of lastFrame.data.attributes) {
          const node = mirror.getNode(attr.id) as HTMLElement | null;
          if (!node || !node.outerHTML) {
            continue;
          }
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          attributes[getSelectorForElem(node)] = {
            tag: node.outerHTML.replace(node.innerHTML, '...'),
            changed: attr.attributes,
          };
        }

        const item = collection.get(lastFrame);
        if (item) {
          const formattedTimestamp = formatDuration({
            duration: [Math.abs(lastFrame.timestamp - startTimestampMs), 'ms'],
            precision: 'ms',
            style: 'hh:mm:ss.sss',
          });
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          item[formattedTimestamp].adds = adds;
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          item[formattedTimestamp].attributes = attributes;
        }
      }

      const offset = Math.abs(frame.timestamp - startTimestampMs);
      const formattedTimestamp = formatDuration({
        duration: [offset, 'ms'],
        precision: 'ms',
        style: 'hh:mm:ss.sss',
      });

      lastFrame = frame;
      if (frame.type === EventType.FullSnapshot) {
        collection.set(frame, {
          [formattedTimestamp]: {
            adds: {},
            attributes: {},
            removes: {document: '*'},
            offset,
            timestamp: frame.timestamp,
          },
        });
      } else if (
        frame.type === EventType.IncrementalSnapshot &&
        'source' in frame.data &&
        frame.data.source === IncrementalSource.Mutation
      ) {
        const removes = {};
        for (const removal of frame.data.removes) {
          const node = mirror.getNode(removal.id) as HTMLElement | null;
          if (!node || !node.outerHTML) {
            continue;
          }
          const selector = getSelectorForElem(node);
          const rootIsRemoved = Object.keys(removes).some(key =>
            selector.startsWith(key)
          );
          if (rootIsRemoved) {
            continue;
          }

          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          removes[selector] = {
            html: node.outerHTML,
          };
        }

        collection.set(frame, {
          [formattedTimestamp]: {
            adds: {},
            attributes: {},
            removes,
            offset,
            timestamp: frame.timestamp,
          },
        });
      }
    },
  });

  if (lastFrame) {
    // An extra frame is added because we increment past the target when we run
    // these two statements: `hasFinishedVisiting = true; return true;`, the
    // intention is that we'll step one more time and fill in `lastFrame`.
    // But for the extra frame, we don't fill it in later, we'll just pop it off.
    results.delete(lastFrame);
  }

  return results;
}

function getNameForElem(element: HTMLElement) {
  if (element.id) {
    return `#${element.id}`;
  }
  const parts = [
    element.tagName.toLowerCase(),
    element.className && typeof element.className === 'string'
      ? `.${element.className.split(' ').filter(Boolean).join('.')}`
      : '',
  ];
  const attrs = [
    'data-sentry-element',
    'data-sentry-source-file',
    'data-test-id',
    'data-testid',
  ];
  for (const attr of attrs) {
    const value = element.getAttribute(attr);
    if (value) {
      parts.push(`[${attr}=${value}]`);
    }
  }
  return parts.join('');
}

// Copy Selector => `#blk_router > div.tsqd-parent-container > div > div`
// Copy JS Path => `document.querySelector("#blk_router > div.tsqd-parent-container > div > div")`
// Copy XPath => `//*[@id="blk_router"]/div[2]/div/div`
// Copy Full XPath => `/html/body/div[1]/div[2]/div/div`
function getSelectorForElem(element: HTMLElement): string {
  const parts: string[] = [];
  let elem: HTMLElement | null =
    element.nodeType !== Node.ELEMENT_NODE ? element.parentElement : element;

  while (elem) {
    parts.unshift(getNameForElem(elem));
    if (elem.id !== '' || (elem.getAttribute('data-sentry-element') ?? '') !== '') {
      break;
    }
    elem = elem.parentElement;
  }
  return parts.join(' > ');
}

interface Props {
  leftOffsetMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
}

export default function useExtractDiffMutations({
  leftOffsetMs,
  replay,
  rightOffsetMs,
}: Props): UseQueryResult<Map<ReplayFrame, DiffMutation>> {
  const startTimestampMs = replay.getReplay().started_at.getTime();
  const rangeStartTimestampMs = startTimestampMs + leftOffsetMs;
  const rangeEndTimestampMs = startTimestampMs + rightOffsetMs;

  return useQuery({
    queryKey: [
      'extractDiffMutations',
      replay,
      rangeStartTimestampMs,
      rangeEndTimestampMs,
    ],
    queryFn: () =>
      extractDiffMutations({replay, rangeStartTimestampMs, rangeEndTimestampMs}),
    enabled: true,
    gcTime: Infinity,
  });
}
