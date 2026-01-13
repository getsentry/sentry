import {PureComponent} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import toPercent from 'sentry/utils/number/toPercent';

import type {EnhancedProcessedSpanType, RawSpanType} from './types';
import type {SpanBoundsType, SpanGeneratedBoundsType} from './utils';
import {getSpanOperation} from './utils';

export const MINIMAP_HEIGHT = 120;

class ActualMinimap extends PureComponent<{
  dividerPosition: number;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  rootSpan: RawSpanType;
  spans: EnhancedProcessedSpanType[];
  theme: Theme;
}> {
  renderRootSpan(): React.ReactNode {
    const {spans, generateBounds} = this.props;

    return spans.map((payload, i) => {
      switch (payload.type) {
        case 'root_span':
        case 'span':
        case 'span_group_chain': {
          const {span} = payload;

          const spanBarColor: string = pickBarColor(
            getSpanOperation(span),
            this.props.theme
          );

          const bounds = generateBounds({
            startTimestamp: span.start_timestamp,
            endTimestamp: span.timestamp,
          });
          const {left: spanLeft, width: spanWidth} = this.getBounds(bounds);

          return (
            <MinimapSpanBar
              key={`${payload.type}-${i}`}
              style={{
                backgroundColor:
                  payload.type === 'span_group_chain'
                    ? this.props.theme.tokens.background.accent.vibrant
                    : spanBarColor,
                left: spanLeft,
                width: spanWidth,
              }}
            />
          );
        }
        case 'span_group_siblings': {
          const {spanSiblingGrouping} = payload;

          return (
            <Flex
              height="2px"
              minHeight="2px"
              maxHeight="2px"
              position="relative"
              top="-2px"
              data-test-id="minimap-sibling-group-bar"
              key={`${payload.type}-${i}`}
            >
              {spanSiblingGrouping?.map(({span}, index) => {
                const bounds = generateBounds({
                  startTimestamp: span.start_timestamp,
                  endTimestamp: span.timestamp,
                });
                const {left: spanLeft, width: spanWidth} = this.getBounds(bounds);

                return (
                  <MinimapSpanBar
                    style={{
                      backgroundColor: this.props.theme.tokens.background.accent.vibrant,
                      left: spanLeft,
                      width: spanWidth,
                      minWidth: 0,
                      position: 'absolute',
                    }}
                    key={index}
                  />
                );
              })}
            </Flex>
          );
        }
        default: {
          return null;
        }
      }
    });
  }

  getBounds(bounds: SpanGeneratedBoundsType): {
    left: string;
    width: string;
  } {
    switch (bounds.type) {
      case 'TRACE_TIMESTAMPS_EQUAL':
      case 'INVALID_VIEW_WINDOW': {
        return {
          left: toPercent(0),
          width: '0px',
        };
      }

      case 'TIMESTAMPS_EQUAL': {
        return {
          left: toPercent(bounds.start),
          width: `${bounds.width}px`,
        };
      }
      case 'TIMESTAMPS_REVERSED':
      case 'TIMESTAMPS_STABLE': {
        return {
          left: toPercent(bounds.start),
          width: toPercent(bounds.end - bounds.start),
        };
      }
      default: {
        const _exhaustiveCheck: never = bounds;
        return _exhaustiveCheck;
      }
    }
  }

  render() {
    const {dividerPosition} = this.props;
    return (
      <MinimapBackground
        style={{
          // the width of this component is shrunk to compensate for half of the width of the divider line
          width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
          left: `calc(${toPercent(dividerPosition)} + 0.5px)`,
        }}
      >
        <BackgroundSlider id="minimap-background-slider">
          {this.renderRootSpan()}
        </BackgroundSlider>
      </MinimapBackground>
    );
  }
}

export const MinimapBackground = styled('div')`
  height: ${MINIMAP_HEIGHT}px;
  max-height: ${MINIMAP_HEIGHT}px;
  overflow: hidden;
  position: absolute;
  top: 0;
`;

const MinimapSpanBar = styled('div')`
  position: relative;
  height: 2px;
  min-height: 2px;
  max-height: 2px;
  margin: 2px 0;
  min-width: 1px;
  border-radius: 1px;
  box-sizing: border-box;
`;

const BackgroundSlider = styled('div')`
  position: relative;
`;

export {ActualMinimap};
