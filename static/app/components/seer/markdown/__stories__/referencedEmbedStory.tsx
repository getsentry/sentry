import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SeerEmbedResolverProvider, SeerMarkdown} from 'sentry/components/seer/markdown';
import {Demo} from 'sentry/stories';

const LANE = {
  a3f: {
    title: 'Error volume',
    visualization: 'line',
    x_axis: 'time',
    y_axis_unit: 'number',
    series: [
      {
        label: 'Errors',
        data: [
          {x: '2026-07-30T12:00:00Z', y: 12},
          {x: '2026-07-30T13:00:00Z', y: 31},
          {x: '2026-07-30T14:00:00Z', y: 18},
        ],
      },
    ],
  },
  b7c: {
    title: 'Checkout p95',
    visualization: 'area',
    x_axis: 'time',
    y_axis_unit: 'duration',
    series: [
      {
        label: 'p95',
        data: [
          {x: '2026-07-30T12:00:00Z', y: 240},
          {x: '2026-07-30T13:00:00Z', y: 910},
          {x: '2026-07-30T14:00:00Z', y: 380},
        ],
      },
    ],
  },
} as const;

const RAW = [
  'Errors climbed after the deploy, and checkout latency followed.',
  '',
  '{% chart ref="blk-9.chart.a3f" /%}',
  '',
  '{% chart ref="blk-9.chart.b7c" /%}',
].join('\n');

/**
 * An assistant message carrying only addresses. Each payload arrived earlier on a tool result's
 * `structuredContent`, so neither chart's data appears in the markdown the model wrote.
 */
export function ReferencedEmbedStory() {
  return (
    <Stack gap="xl">
      <Text>
        Two charts of one type in a single message, each resolving to its own payload.
      </Text>
      <CodeBlock language="markdown">{RAW}</CodeBlock>
      <Demo>
        <SeerEmbedResolverProvider
          resolver={(blockId, name, key) =>
            blockId === 'blk-9' && name === 'chart'
              ? LANE[key as keyof typeof LANE]
              : undefined
          }
        >
          <SeerMarkdown raw={RAW} />
        </SeerEmbedResolverProvider>
      </Demo>
    </Stack>
  );
}
