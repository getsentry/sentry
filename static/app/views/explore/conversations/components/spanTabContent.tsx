import {useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {splitScrubbedJson} from 'sentry/views/insights/pages/agents/components/scrubbedText';
import {AIContentRenderer} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';
import {tryParseJsonRecursive} from 'sentry/views/performance/traceDetails/traceDrawer/details/utils';

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
    <SpanTabJson value={content} clip={clip} />
  );
}

/** Renders JSON as a tree that highlights the values PII scrubbing changed. */
export function SpanTabJson({
  value: markedValue,
  maxDefaultDepth = SPAN_TAB_JSON_MAX_DEFAULT_DEPTH,
  clip = false,
}: {
  value: unknown;
  clip?: boolean;
  maxDefaultDepth?: number;
}) {
  // Parsed here, like `MultilineJSON` does, so the meta matches the parsed value.
  const {value, meta} = useMemo(
    () => splitScrubbedJson(tryParseJsonRecursive(markedValue)),
    [markedValue]
  );
  return (
    <TraceDrawerComponents.MultilineJSON
      value={value}
      meta={meta}
      maxDefaultDepth={maxDefaultDepth}
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
