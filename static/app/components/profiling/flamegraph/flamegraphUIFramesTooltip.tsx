import {useMemo} from 'react';
import * as React from 'react';
import type {vec2} from 'gl-matrix';

import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {t} from 'sentry/locale';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {toRGBAString} from 'sentry/utils/profiling/colors/utils';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {UIFramesRenderer} from 'sentry/utils/profiling/renderers/UIFramesRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import type {UIFrames} from 'sentry/utils/profiling/uiFrames';

import {
  FlamegraphTooltipColorIndicator,
  FlamegraphTooltipFrameMainInfo,
  FlamegraphTooltipTimelineInfo,
} from './flamegraphTooltip';

export interface FlamegraphUIFramesTooltipProps {
  canvasBounds: Rect;
  configSpaceCursor: vec2;
  hoveredNode: UIFrames['frames'];
  uiFrames: UIFrames;
  uiFramesCanvas: FlamegraphCanvas;
  uiFramesRenderer: UIFramesRenderer;
  uiFramesView: CanvasView<UIFrames>;
}

export function FlamegraphUIFramesTooltip({
  canvasBounds,
  configSpaceCursor,
  uiFramesCanvas,
  uiFrames,
  uiFramesView,
  uiFramesRenderer,
  hoveredNode,
}: FlamegraphUIFramesTooltipProps) {
  const uiFramesInConfigSpace = useMemo<
    Array<{rect: Rect; type: UIFrames['frames'][0]['type']}>
  >(() => {
    const framesInConfigSpace = hoveredNode.map(frame => {
      return {
        type: frame.type,
        rect: new Rect(frame.start, frame.end, frame.end - frame.start, 1),
      };
    });
    return framesInConfigSpace.sort((a, b) => a.type.localeCompare(b.type));
  }, [hoveredNode]);

  return (
    <BoundTooltip
      cursor={configSpaceCursor}
      canvas={uiFramesCanvas}
      canvasBounds={canvasBounds}
      canvasView={uiFramesView}
    >
      {uiFramesInConfigSpace.map((frame, i) => {
        const rect = frame.rect.transformRect(uiFramesView.configSpaceTransform);

        return (
          <React.Fragment key={i}>
            <FlamegraphTooltipFrameMainInfo>
              <FlamegraphTooltipColorIndicator
                backgroundColor={toRGBAString(
                  ...uiFramesRenderer.getColorForFrame(frame.type)
                )}
              />
              {uiFrames.formatter(rect.width)}{' '}
              {frame.type === 'frozen' ? t('frozen frame') : t('slow frame')}
            </FlamegraphTooltipFrameMainInfo>
            <FlamegraphTooltipTimelineInfo>
              {uiFrames.timelineFormatter(rect.left)} {' \u2014 '}
              {uiFrames.timelineFormatter(rect.right)}
            </FlamegraphTooltipTimelineInfo>
          </React.Fragment>
        );
      })}
    </BoundTooltip>
  );
}
