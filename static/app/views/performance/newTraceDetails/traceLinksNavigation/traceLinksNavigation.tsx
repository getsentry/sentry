import {ButtonBar} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {TraceLinkNavigationButton} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/traceLinkNavigationButton';

export function TraceLinksNavigation({
  rootEventResults,
  source,
}: {
  rootEventResults: TraceRootEventQueryResults;
  source: string;
}) {
  const showLinkedTraces =
    // Don't show the linked traces buttons when the waterfall is embedded in the replay
    // detail page, as it already contains all traces of the replay session.
    source !== 'replay';

  if (
    !showLinkedTraces ||
    !isTraceItemDetailsResponse(rootEventResults.data) ||
    !rootEventResults.data.timestamp
  ) {
    return null;
  }

  return (
    <div>
      <ButtonBar merged gap="0">
        <TraceLinkNavigationButton
          direction="previous"
          attributes={rootEventResults.data.attributes}
          currentTraceStartTimestamp={
            new Date(rootEventResults.data.timestamp).getTime() / 1000
          }
          tooltipProps={{
            position: 'top',
            delay: 400,
            isHoverable: true,
            title: tct(
              `Go to the previous trace of the same session. [link:Learn More]`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#previous-and-next-traces" />
                ),
              }
            ),
          }}
        />
        <TraceLinkNavigationButton
          direction="next"
          attributes={rootEventResults.data.attributes}
          currentTraceStartTimestamp={
            new Date(rootEventResults.data.timestamp).getTime() / 1000
          }
          tooltipProps={{
            position: 'top',
            delay: 400,
            isHoverable: true,
            title: tct(`Go to the next trace of the same session. [link:Learn More]`, {
              link: (
                <ExternalLink href="https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#previous-and-next-traces" />
              ),
            }),
          }}
        />
      </ButtonBar>
    </div>
  );
}
