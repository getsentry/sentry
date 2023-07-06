import {useMemo} from 'react';
import * as React from 'react';
import {vec2} from 'gl-matrix';

import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {UIFramesRenderer} from 'sentry/domains/profiling/renderers/uiFramesRenderer';
import {toRGBAString} from 'sentry/domains/profiling/utils/colors/utils';
import {CanvasView} from 'sentry/domains/profiling/utils/profiling/canvasView';
import {FlamegraphCanvas} from 'sentry/domains/profiling/utils/profiling/flamegraphCanvas';
import {UIFrames} from 'sentry/domains/profiling/utils/profiling/uiFrames';
import {Rect} from 'sentry/domains/profiling/utils/speedscope';
import {t} from 'sentry/locale';

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
    {rect: Rect; type: UIFrames['frames'][0]['type']}[]
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
      bounds={canvasBounds}
      cursor={configSpaceCursor}
      canvas={uiFramesCanvas}
      canvasView={uiFramesView}
    >
      {uiFramesInConfigSpace.map((frame, i) => {
        return (
          <React.Fragment key={i}>
            <FlamegraphTooltipFrameMainInfo>
              <FlamegraphTooltipColorIndicator
                backgroundColor={toRGBAString(
                  ...uiFramesRenderer.getColorForFrame(frame.type)
                )}
              />
              {uiFrames.formatter(frame.rect.width)}{' '}
              {frame.type === 'frozen' ? t('frozen frame') : t('slow frame')}
            </FlamegraphTooltipFrameMainInfo>
            <FlamegraphTooltipTimelineInfo>
              {uiFrames.timelineFormatter(frame.rect.left)} {' \u2014 '}
              {uiFrames.timelineFormatter(frame.rect.right)}
            </FlamegraphTooltipTimelineInfo>
          </React.Fragment>
        );
      })}
    </BoundTooltip>
  );
}
