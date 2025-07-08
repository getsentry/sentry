import {useMemo} from 'react';
import type {vec2} from 'gl-matrix';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {formatColorForSpan} from 'sentry/utils/profiling/gl/utils';
import type {SpanChartRenderer2D} from 'sentry/utils/profiling/renderers/spansRenderer';
import type {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {FlamegraphTooltipColorIndicator} from './flamegraphTooltip';

function formatWeightToTransactionDuration(span: SpanChartNode, spanChart: SpanChart) {
  return `(${Math.round((span.duration / spanChart.root.duration) * 100)}%)`;
}

interface FlamegraphSpanTooltipProps {
  configSpaceCursor: vec2;
  hoveredNode: SpanChartNode;
  spanChart: SpanChart;
  spansCanvas: FlamegraphCanvas;
  spansRenderer: SpanChartRenderer2D;
  spansView: CanvasView<SpanChart>;
}

export function FlamegraphSpanTooltip({
  configSpaceCursor,
  spansCanvas,
  spanChart,
  spansView,
  spansRenderer,
  hoveredNode,
}: FlamegraphSpanTooltipProps) {
  const spanInConfigSpace = useMemo<Rect>(() => {
    return new Rect(
      hoveredNode.start,
      hoveredNode.end,
      hoveredNode.end - hoveredNode.start,
      1
    ).transformRect(spansView.configSpaceTransform);
  }, [spansView, hoveredNode]);

  return (
    <BoundTooltip cursor={configSpaceCursor} canvas={spansCanvas} canvasView={spansView}>
      <Flex direction="column" gap={space(1)}>
        <Flex gap={space(1)} align="center">
          <FlamegraphTooltipColorIndicator
            backgroundImage={
              hoveredNode.node.span.op === 'missing span instrumentation'
                ? `url(${spansRenderer.patternDataUrl})`
                : 'none'
            }
            backgroundColor={formatColorForSpan(hoveredNode, spansRenderer)}
          />
          <Text monospace wrap="nowrap" ellipsis>
            {spanChart.formatter(hoveredNode.duration)}{' '}
            {formatWeightToTransactionDuration(hoveredNode, spanChart)} {hoveredNode.text}
          </Text>
        </Flex>
        <Text variant="muted" ellipsis>
          {hoveredNode.node.span.op ? `${t('op')}:${hoveredNode.node.span.op} ` : null}
          {hoveredNode.node.span.status
            ? `${t('status')}:${hoveredNode.node.span.status}`
            : null}
        </Text>
        <Text variant="muted" ellipsis>
          {spansRenderer.spanChart.timelineFormatter(spanInConfigSpace.left)} {' \u2014 '}
          {spansRenderer.spanChart.timelineFormatter(spanInConfigSpace.right)}
        </Text>
      </Flex>
    </BoundTooltip>
  );
}
