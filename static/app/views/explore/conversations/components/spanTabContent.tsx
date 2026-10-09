import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AIContentRenderer} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

export const SPAN_TAB_JSON_MAX_DEFAULT_DEPTH = 3;
export const SPAN_TAB_JSON_AUTO_COLLAPSE_LIMIT = 100_000;

export function SpanTabContent({
  content,
  clip = false,
}: {
  content: unknown;
  clip?: boolean;
}) {
  return typeof content === 'string' ? (
    <AIContentRenderer
      text={content}
      maxJsonDepth={SPAN_TAB_JSON_MAX_DEFAULT_DEPTH}
      autoCollapseLimit={SPAN_TAB_JSON_AUTO_COLLAPSE_LIMIT}
      clip={clip}
    />
  ) : (
    <TraceDrawerComponents.MultilineJSON
      value={content}
      maxDefaultDepth={SPAN_TAB_JSON_MAX_DEFAULT_DEPTH}
      autoCollapseLimit={SPAN_TAB_JSON_AUTO_COLLAPSE_LIMIT}
      clip={clip}
    />
  );
}

export function EmptySpanTab({message}: {message: string}) {
  return (
    <Flex flex="1" background="secondary" radius="md" padding="xl">
      <Text variant="muted">{message}</Text>
    </Flex>
  );
}
