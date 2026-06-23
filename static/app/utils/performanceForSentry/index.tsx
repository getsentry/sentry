import type {ProfilerOnRenderCallback, ReactNode} from 'react';
import {Fragment, Profiler, useEffect, useRef} from 'react';
import type {Client, Span} from '@sentry/core';
import {
  browserPerformanceTimeOrigin,
  spanToStreamedSpanJSON,
  timestampInSeconds,
} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {useLocation} from 'sentry/utils/useLocation';
import {usePrevious} from 'sentry/utils/usePrevious';

const MIN_UPDATE_SPAN_TIME = 16; // Frame boundary @ 60fps
const WAIT_POST_INTERACTION = 50; // Leave a small amount of time for observers and onRenderCallback to log since they come in after they occur and not during.
const INTERACTION_TIMEOUT = 2 * 60_000; // 2min. Wrap interactions up after this time since we don't want transactions sticking around forever.
const VCD_START = 'vcd-start';
const VCD_END = 'vcd-end';

// This re-export makes it possible to stub out the Profiler globally if required
export {Profiler};

/**
 * It depends on where it is called but the way we fetch transactions can be empty despite an ongoing transaction existing.
 * This will return an interaction-type transaction held onto by a class static if one exists.
 */
function getPerformanceTransaction(): Span | undefined {
  const span = PerformanceInteraction.getSpan();
  if (span) {
    return span;
  }

  const activeSpan = Sentry.getActiveSpan();
  return activeSpan ? Sentry.getRootSpan(activeSpan) : undefined;
}

/**
 * Callback for React Profiler https://reactjs.org/docs/profiler.html
 */
export const onRenderCallback: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  try {
    const parentSpan = getPerformanceTransaction();
    if (parentSpan && actualDuration > MIN_UPDATE_SPAN_TIME) {
      const now = timestampInSeconds();

      Sentry.withActiveSpan(parentSpan, () => {
        Sentry.startInactiveSpan({
          name: `<${id}>`,
          op: `ui.react.${phase}`,
          startTime: now - actualDuration / 1000,
        }).end(now);
      });
    }
  } catch (_) {
    // Add defensive catch since this wraps all of App
  }
};

const PerformanceInteraction = (function () {
  let _INTERACTION_SPAN: Span | null = null;
  let _INTERACTION_TIMEOUT_ID: number | undefined;
  return {
    getSpan() {
      return _INTERACTION_SPAN;
    },

    startInteraction(name: string, timeout = INTERACTION_TIMEOUT, immediate = true) {
      try {
        const currentSpan = Sentry.getActiveSpan();
        if (currentSpan) {
          const currentIdleSpan = Sentry.getRootSpan(currentSpan);
          // If interaction is started while idle still exists.
          currentIdleSpan.setAttribute(
            'sentry.idle_span_finish_reason',
            'sentry.interactionStarted'
          );
          currentIdleSpan.end();
        }
        PerformanceInteraction.finishInteraction(immediate);

        const span = Sentry.startInactiveSpan({
          name: `ui.${name}`,
          op: 'interaction',
          forceTransaction: true,
        });

        _INTERACTION_SPAN = span || null;

        // Auto interaction timeout
        _INTERACTION_TIMEOUT_ID = window.setTimeout(() => {
          if (!_INTERACTION_SPAN) {
            return;
          }
          _INTERACTION_SPAN.setAttribute('ui.interaction.finish', 'timeout');
          PerformanceInteraction.finishInteraction(true);
        }, timeout);
      } catch (e: any) {
        Sentry.captureMessage(e);
      }
    },

    async finishInteraction(immediate = false) {
      try {
        if (!_INTERACTION_SPAN) {
          return;
        }
        clearTimeout(_INTERACTION_TIMEOUT_ID);

        if (immediate) {
          _INTERACTION_SPAN.end();
          _INTERACTION_SPAN = null;
          return;
        }

        // Add a slight wait if this isn't called as the result of another transaction starting.
        await new Promise(resolve => setTimeout(resolve, WAIT_POST_INTERACTION));
        _INTERACTION_SPAN?.end();
        _INTERACTION_SPAN = null;

        return;
      } catch (e: any) {
        Sentry.captureMessage(e);
      }
    },
  };
})();

/**
 * This component wraps the main component on a page with a measurement checking for visual completedness.
 * It uses the data check to make sure endpoints have resolved and the component is meaningfully rendering
 * which sets it apart from simply checking LCP, which makes it a good back up check the LCP heuristic performance.
 *
 * Since this component is guaranteed to be part of the -real- critical path, it also wraps the component with the custom profiler.
 */
export function VisuallyCompleteWithData({
  id,
  hasData,
  children,
  disabled,
  isLoading,
}: {
  children: ReactNode;
  hasData: boolean;
  id: string;
  disabled?: boolean;
  /**
   * Add isLoading to also collect navigation timings, since the data state is sometimes constant before the reload occurs.
   */
  isLoading?: boolean;
}) {
  const location = useLocation();
  const previousLocation = usePrevious(location);

  const isDataCompleteSet = useRef(false);

  const num = useRef(1);

  const isVCDSet = useRef(false);

  const locationPath = useRef(location.pathname);
  locationPath.current = location.pathname;

  if (isVCDSet && hasData && performance?.mark && !disabled) {
    performance.mark(`${id}-${VCD_START}`);
    isVCDSet.current = true;
  }

  const _hasData = isLoading === undefined ? hasData : hasData && !isLoading;

  useEffect(() => {
    // Capture changes in location to reset VCD as it's likely indicative of a route change.
    if (location !== previousLocation) {
      isDataCompleteSet.current = false;
      performance
        .getEntriesByType('mark')
        .map(m => m.name)
        .filter(n => n.includes('vcd'))
        .forEach(n => performance.clearMarks(n));
    }
  }, [location, previousLocation]);

  useEffect(() => {
    if (disabled) {
      return;
    }
    try {
      const span = Sentry.getActiveSpan();

      if (!span) {
        return;
      }
      const rootSpan = Sentry.getRootSpan(span);

      if (!isDataCompleteSet.current && _hasData) {
        isDataCompleteSet.current = true;

        performance.mark(`${id}-${VCD_END}-pretimeout`);

        window.setTimeout(() => {
          if (!browserPerformanceTimeOrigin) {
            return;
          }
          performance.mark(`${id}-${VCD_END}`);
          const startMarks = performance.getEntriesByName(`${id}-${VCD_START}`);
          const endMarks = performance.getEntriesByName(`${id}-${VCD_END}`);
          if (startMarks.length > 1 || endMarks.length > 1) {
            rootSpan.setAttribute('vcd_extra_recorded_marks', true);
          }

          const startMark = startMarks.at(-1);
          const endMark = endMarks.at(-1);
          if (!startMark || !endMark) {
            return;
          }
          try {
            const vcdTime = endMark.startTime - startMark.startTime;
            Sentry.metrics.count('visually_complete_with_data', vcdTime, {
              attributes: {
                url: locationPath.current,
              },
              unit: 'millisecond', // DOMHighResTimeStamp
            });
          } catch (_) {
            // Defensive catch since this code is auxiliary.
          }
          performance.measure(
            `VCD [${id}] #${num.current}`,
            `${id}-${VCD_START}`,
            `${id}-${VCD_END}`
          );
          num.current = num.current++;
        }, 0);
      }
    } catch (_) {
      // Defensive catch since this code is auxiliary.
    }
  }, [_hasData, disabled, id]);

  if (disabled) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      <Fragment>{children}</Fragment>
    </Profiler>
  );
}

/**
 * A util function to help create some broad buckets to group entity counts without exploding cardinality.
 *
 * @param tagName - Name for the tag, will create `<tagName>` in data and `<tagname>.grouped` as a tag
 * @param max - The approximate maximum value for the tag, A bucket between max and Infinity is also captured so it's fine if it's not precise, the data won't be entirely lost.
 * @param n - The value to be grouped, should represent `n` entities.
 * @param [buckets=[1,2,5]] - An optional param to specify the bucket progression. Default is 1,2,5 (10,20,50 etc).
 */
export const setGroupedEntityTag = (
  tagName: string,
  max: number,
  n: number,
  buckets = [1, 2, 5]
) => {
  Sentry.setExtra(tagName, n);
  let groups = [0];
  loop: for (let m = 1, mag = 0; m <= max; m *= 10, mag++) {
    for (const i of buckets) {
      const group = i * 10 ** mag;
      if (group > max) {
        break loop;
      }
      groups = [...groups, group];
    }
  }
  groups = [...groups, +Infinity];
  Sentry.setTag(`${tagName}.grouped`, `<=${groups.find(g => n <= g)}`);
};

/**
 * A temporary util function used for interaction transactions that will attach a tag to the transaction, indicating the element
 * that was interacted with. This will allow for querying for transactions by a specific element. This is a high cardinality tag, but
 * it is only temporary for an experiment
 *
 * Previously, we added the interactionElement tag to the transaction event in
 * beforeSendTransaction. For span streaming, we need to do this via the spanStart
 * hook, since we have no hook anymore where we can add a tag to the root span based
 * on child spans.
 */
export function addUIElementTagToSegmentSpan(client: Client) {
  client.on('spanStart', span => {
    const segmentSpan = Sentry.getRootSpan(span);
    const segmentSpanJson = spanToStreamedSpanJSON(segmentSpan);

    if (segmentSpanJson.attributes?.['sentry.op'] !== 'ui.action.click') {
      return;
    }

    const spanJson = spanToStreamedSpanJSON(span);
    const spanOp = spanJson.attributes?.['sentry.op'];

    if (
      spanOp === 'ui.interaction.click' &&
      !segmentSpanJson.attributes?.interactionElement
    ) {
      segmentSpan.setAttribute('interactionElement', spanJson.name);
    }
  });
}

function supportsINP() {
  return (
    'PerformanceObserver' in window &&
    'PerformanceEventTiming' in window &&
    'interactionId' in PerformanceEventTiming.prototype
  );
}

interface INPPerformanceEntry extends PerformanceEntry {
  cancellable: boolean;
  duration: number;
  entryType: 'first-input';
  name: string;
  processingEnd: number;
  processingStart: number;
  startTime: number;
  target: HTMLElement | undefined;
}

function isINPEntity(entry: PerformanceEntry): entry is INPPerformanceEntry {
  return entry.entryType === 'first-input';
}

export function makeIssuesINPObserver(): PerformanceObserver | undefined {
  if (!supportsINP()) {
    return undefined;
  }

  const observer = new PerformanceObserver(entryList => {
    entryList.getEntries().forEach(entry => {
      if (!isINPEntity(entry)) {
        return;
      }

      if (entry.duration) {
        // < 16 ms wont cause frame drops so just ignore this for now
        if (entry.duration < 16) {
          return;
        }
      }
    });
  });

  observer.observe({type: 'first-input', buffered: true});
  return observer;
}
