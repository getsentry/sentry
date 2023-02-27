import {
  Fragment,
  LegacyRef,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {useTheme} from '@emotion/react';

import Count from 'sentry/components/count';
import {
  getSpanBarColours,
  ROW_HEIGHT,
  SpanBarType,
} from 'sentry/components/performance/waterfall/constants';
import {
  Row,
  RowCell,
  RowCellContainer,
} from 'sentry/components/performance/waterfall/row';
import {
  DividerContainer,
  DividerLine,
  DividerLineGhostContainer,
} from 'sentry/components/performance/waterfall/rowDivider';
import {
  RowTitle,
  RowTitleContainer,
  SpanGroupRowTitleContent,
} from 'sentry/components/performance/waterfall/rowTitle';
import {
  TOGGLE_BORDER_BOX,
  TreeToggle,
  TreeToggleContainer,
} from 'sentry/components/performance/waterfall/treeConnector';
import {toPercent} from 'sentry/components/performance/waterfall/utils';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {PerformanceInteraction} from 'sentry/utils/performanceForSentry';

import * as DividerHandlerManager from './dividerHandlerManager';
import SpanBarCursorGuide from './spanBarCursorGuide';
import {MeasurementMarker} from './styles';
import {EnhancedSpan, ProcessedSpanType} from './types';
import {
  getMeasurementBounds,
  getMeasurements,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  spanTargetHash,
} from './utils';

const MARGIN_LEFT = 0;

type Props = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  didAnchoredSpanMount: () => boolean;
  event: Readonly<EventTransaction>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  getCurrentLeftPos: () => number;
  onWheel: (deltaX: number) => void;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  renderGroupSpansTitle: () => React.ReactNode;
  renderSpanRectangles: () => React.ReactNode;
  renderSpanTreeConnector: () => React.ReactNode;
  span: Readonly<ProcessedSpanType>;
  spanGrouping: EnhancedSpan[];
  spanNumber: number;
  toggleSpanGroup: () => void;
  treeDepth: number;
  spanBarType?: SpanBarType;
};

function renderGroupedSpansToggler(props: Props) {
  const {treeDepth, spanGrouping, renderSpanTreeConnector, toggleSpanGroup, spanBarType} =
    props;

  const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;

  return (
    <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
      {renderSpanTreeConnector()}
      <TreeToggle
        disabled={false}
        isExpanded={false}
        errored={false}
        isSpanGroupToggler
        onClick={event => {
          event.stopPropagation();
          toggleSpanGroup();
        }}
        spanBarType={spanBarType}
      >
        <Count value={spanGrouping.length} />
      </TreeToggle>
    </TreeToggleContainer>
  );
}

function renderDivider(
  dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
) {
  const {addDividerLineRef} = dividerHandlerChildrenProps;

  return (
    <DividerLine
      ref={addDividerLineRef()}
      style={{
        position: 'absolute',
      }}
      onMouseEnter={() => {
        dividerHandlerChildrenProps.setHover(true);
      }}
      onMouseLeave={() => {
        dividerHandlerChildrenProps.setHover(false);
      }}
      onMouseOver={() => {
        dividerHandlerChildrenProps.setHover(true);
      }}
      onMouseDown={dividerHandlerChildrenProps.onDragStart}
      onClick={event => {
        // we prevent the propagation of the clicks from this component to prevent
        // the span detail from being opened.
        event.stopPropagation();
      }}
    />
  );
}

function renderMeasurements(
  event: Readonly<EventTransaction>,
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType
) {
  const measurements = getMeasurements(event, generateBounds);

  return (
    <Fragment>
      {Array.from(measurements).map(([timestamp, verticalMark]) => {
        const bounds = getMeasurementBounds(timestamp, generateBounds);

        const shouldDisplay = defined(bounds.left) && defined(bounds.width);

        if (!shouldDisplay || !bounds.isSpanVisibleInView) {
          return null;
        }

        return (
          <MeasurementMarker
            key={String(timestamp)}
            style={{
              left: `clamp(0%, ${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
            }}
            failedThreshold={verticalMark.failedThreshold}
          />
        );
      })}
    </Fragment>
  );
}

export function SpanGroupBar(props: Props) {
  const spanTitleRef: LegacyRef<HTMLDivElement> | null = useRef(null);
  const spanContentRef: MutableRefObject<HTMLDivElement | null> = useRef(null);

  const {
    onWheel,
    addContentSpanBarRef,
    removeContentSpanBarRef,
    didAnchoredSpanMount,
    spanGrouping,
    toggleSpanGroup,
    getCurrentLeftPos,
    spanBarType,
  } = props;

  const theme = useTheme();

  // On mount, it is necessary to set the left styling of the content here due to the span tree being virtualized.
  // If we rely on the scrollBarManager to set the styling, it happens too late and awkwardly applies an animation.
  const setTransformCallback = useCallback(
    (ref: HTMLDivElement | null) => {
      if (ref) {
        spanContentRef.current = ref;
        addContentSpanBarRef(ref);
        const left = -getCurrentLeftPos();
        ref.style.transform = `translateX(${left}px)`;
        ref.style.transformOrigin = 'left';
        return;
      }

      // If ref is null, this means the component is about to unmount
      removeContentSpanBarRef(spanContentRef.current);
    },
    [addContentSpanBarRef, removeContentSpanBarRef, getCurrentLeftPos]
  );

  useEffect(() => {
    if (location.hash && !didAnchoredSpanMount()) {
      const anchoredSpanIndex = spanGrouping.findIndex(
        span => spanTargetHash(span.span.span_id) === location.hash
      );

      // TODO: This doesn't always work.
      // A potential fix is to just scroll to the Autogroup without expanding it if a span within it is anchored.
      if (anchoredSpanIndex > -1) {
        toggleSpanGroup();
        window.scrollTo(0, window.scrollY + anchoredSpanIndex * ROW_HEIGHT);
      }
    }
  }, [didAnchoredSpanMount, spanGrouping, toggleSpanGroup]);

  useEffect(() => {
    const currentRef = spanTitleRef.current;
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (Math.abs(event.deltaY) === Math.abs(event.deltaX)) {
        return;
      }

      onWheel(event.deltaX);
    };

    if (currentRef) {
      currentRef.addEventListener('wheel', handleWheel, {
        passive: false,
      });
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('wheel', handleWheel);
      }
    };
  }, [onWheel]);

  return (
    <DividerHandlerManager.Consumer>
      {(
        dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
      ) => {
        const {generateBounds, span, treeDepth, spanNumber, event} = props;

        const {isSpanVisibleInView: isSpanVisible} = generateBounds({
          startTimestamp: span.start_timestamp,
          endTimestamp: span.timestamp,
        });

        const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;
        const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;

        return (
          <Row
            visible={isSpanVisible}
            showBorder={false}
            data-test-id={`span-row-${spanNumber}`}
          >
            <RowCellContainer>
              <RowCell
                data-type="span-row-cell"
                style={{
                  width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                  paddingTop: 0,
                }}
                onClick={() => {
                  PerformanceInteraction.startInteraction('SpanTreeToggle', 1000 * 10);
                  props.toggleSpanGroup();
                }}
                ref={spanTitleRef}
              >
                <RowTitleContainer ref={setTransformCallback}>
                  {renderGroupedSpansToggler(props)}
                  <RowTitle
                    style={{
                      left: `${left}px`,
                      width: '100%',
                    }}
                  >
                    <SpanGroupRowTitleContent
                      color={getSpanBarColours(spanBarType, theme).primary}
                    >
                      {props.renderGroupSpansTitle()}
                    </SpanGroupRowTitleContent>
                  </RowTitle>
                </RowTitleContainer>
              </RowCell>
              <DividerContainer>
                {renderDivider(dividerHandlerChildrenProps)}
              </DividerContainer>
              <RowCell
                data-type="span-row-cell"
                showStriping={spanNumber % 2 !== 0}
                style={{
                  width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
                }}
                onClick={() => toggleSpanGroup()}
              >
                {props.renderSpanRectangles()}
                {renderMeasurements(event, generateBounds)}
                <SpanBarCursorGuide />
              </RowCell>
              <DividerLineGhostContainer
                style={{
                  width: `calc(${toPercent(dividerPosition)} + 0.5px)`,
                  display: 'none',
                }}
              >
                <DividerLine
                  ref={addGhostDividerLineRef()}
                  style={{
                    right: 0,
                  }}
                  className="hovering"
                  onClick={e => {
                    // the ghost divider line should not be interactive.
                    // we prevent the propagation of the clicks from this component to prevent
                    // the span detail from being opened.
                    e.stopPropagation();
                  }}
                />
              </DividerLineGhostContainer>
            </RowCellContainer>
          </Row>
        );
      }}
    </DividerHandlerManager.Consumer>
  );
}
