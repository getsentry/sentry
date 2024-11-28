import {createRef, Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import {Observer} from 'mobx-react';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import type {SpanDetailProps} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import NewTraceDetailsSpanTree from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanTree';
import * as ScrollbarManager from 'sentry/components/events/interfaces/spans/scrollbarManager';
import * as SpanContext from 'sentry/components/events/interfaces/spans/spanContext';
import {MeasurementMarker} from 'sentry/components/events/interfaces/spans/styles';
import type {
  SpanBoundsType,
  SpanGeneratedBoundsType,
  VerticalMark,
} from 'sentry/components/events/interfaces/spans/utils';
import {
  getMeasurementBounds,
  parseTraceDetailsURLHash,
  transactionTargetHash,
} from 'sentry/components/events/interfaces/spans/utils';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {
  Row,
  RowCell,
  RowCellContainer,
  RowReplayTimeIndicators,
} from 'sentry/components/performance/waterfall/row';
import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {
  DividerContainer,
  DividerLine,
  DividerLineGhostContainer,
  ErrorBadge,
  MetricsBadge,
} from 'sentry/components/performance/waterfall/rowDivider';
import {
  RowTitle,
  RowTitleContainer,
  RowTitleContent,
} from 'sentry/components/performance/waterfall/rowTitle';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
  TreeToggle,
  TreeToggleContainer,
  TreeToggleIcon,
} from 'sentry/components/performance/waterfall/treeConnector';
import {
  getDurationDisplay,
  getHumanDuration,
} from 'sentry/components/performance/waterfall/utils';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {IconZoom} from 'sentry/icons/iconZoom';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {hasMetricsExperimentalFeature} from 'sentry/utils/metrics/features';
import toPercent from 'sentry/utils/number/toPercent';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';
import {
  isTraceError,
  isTraceRoot,
  isTraceTransaction,
} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import type {EventDetail} from './newTraceDetailsContent';
import {ProjectBadgeContainer} from './styles';
import type {TraceInfo, TraceRoot, TreeDepth} from './types';
import {shortenErrorTitle} from './utils';

const MARGIN_LEFT = 0;
const TRANSACTION_BAR_HEIGHT = 24;

type Props = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  continuingDepths: TreeDepth[];
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  hasGuideAnchor: boolean;
  index: number;
  isBarScrolledTo: boolean;
  isExpanded: boolean;
  isLast: boolean;
  isOrphan: boolean;
  isVisible: boolean;
  location: Location;
  onBarScrolledTo: () => void;
  onWheel: (deltaX: number) => void;
  organization: Organization;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  toggleExpandedState: () => void;
  traceInfo: TraceInfo;
  traceViewRef: React.RefObject<HTMLDivElement>;
  transaction: TraceRoot | TraceFullDetailed | TraceError;
  barColor?: string;
  isOrphanError?: boolean;
  measurements?: Map<number, VerticalMark>;
  numOfOrphanErrors?: number;
  onRowClick?: (detailKey: EventDetail | SpanDetailProps | undefined) => void;
  onlyOrphanErrors?: boolean;
};

function NewTraceDetailsTransactionBar(props: Props) {
  const hashValues = parseTraceDetailsURLHash(props.location.hash);
  const openPanel = decodeScalar(props.location.query.openPanel);
  const eventIDInQueryParam = !!(
    isTraceTransaction(props.transaction) &&
    hashValues?.eventId &&
    hashValues.eventId === props.transaction.event_id
  );
  const isHighlighted = !!(!hashValues?.spanId && eventIDInQueryParam);
  const highlightEmbeddedSpan = !!(hashValues?.spanId && eventIDInQueryParam);
  const [showEmbeddedChildren, setShowEmbeddedChildren] = useState(
    isHighlighted || highlightEmbeddedSpan
  );
  const [isIntersecting, setIntersecting] = useState(false);
  const transactionRowDOMRef = createRef<HTMLDivElement>();
  const transactionTitleRef = createRef<HTMLDivElement>();
  let spanContentRef: HTMLDivElement | null = null;
  const navigate = useNavigate();

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      // https://stackoverflow.com/q/57358640
      // https://github.com/facebook/react/issues/14856
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (Math.abs(event.deltaY) === Math.abs(event.deltaX)) {
        return;
      }

      const {onWheel} = props;
      onWheel(event.deltaX);
    },
    [props]
  );

  const scrollIntoView = useCallback(() => {
    const element = transactionRowDOMRef.current;
    if (!element) {
      return;
    }
    const boundingRect = element.getBoundingClientRect();
    const offset = boundingRect.top + window.scrollY - TRANSACTION_BAR_HEIGHT;
    window.scrollTo(0, offset);
    props.onBarScrolledTo();
  }, [transactionRowDOMRef, props]);

  useEffect(() => {
    const {transaction, isBarScrolledTo} = props;
    const observer = new IntersectionObserver(([entry]) =>
      setIntersecting(entry.isIntersecting)
    );

    if (transactionRowDOMRef.current) {
      observer.observe(transactionRowDOMRef.current);
    }

    if (
      'event_id' in transaction &&
      hashValues?.eventId === transaction.event_id &&
      !isIntersecting &&
      !isBarScrolledTo
    ) {
      scrollIntoView();
    }

    if (isIntersecting) {
      props.onBarScrolledTo();
    }

    return () => {
      observer.disconnect();
    };
  }, [
    setIntersecting,
    hashValues?.eventId,
    hashValues?.spanId,
    props,
    scrollIntoView,
    isIntersecting,
    transactionRowDOMRef,
  ]);

  useEffect(() => {
    const transactionTitleRefCurrentCopy = transactionTitleRef.current;

    if (transactionTitleRefCurrentCopy) {
      transactionTitleRefCurrentCopy.addEventListener('wheel', handleWheel, {
        passive: false,
      });
    }

    return () => {
      if (transactionTitleRefCurrentCopy) {
        transactionTitleRefCurrentCopy.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel, props, transactionTitleRef]);

  const transactionEvent =
    isTraceTransaction<TraceFullDetailed>(props.transaction) ||
    isTraceError(props.transaction)
      ? props.transaction
      : undefined;
  const {
    data: embeddedChildren,
    isPending: isEmbeddedChildrenLoading,
    error: embeddedChildrenError,
  } = useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${transactionEvent?.project_slug}:${transactionEvent?.event_id}/`,
    ],
    {
      staleTime: 2 * 60 * 1000,
      enabled: showEmbeddedChildren || isHighlighted,
    }
  );

  const waterfallModel = useMemo(() => {
    return embeddedChildren
      ? new WaterfallModel(
          embeddedChildren,
          undefined,
          undefined,
          undefined,
          props.traceInfo
        )
      : null;
  }, [embeddedChildren, props.traceInfo]);

  useEffect(() => {
    if (isTraceTransaction(props.transaction) && !isTraceError(props.transaction)) {
      if (isHighlighted && props.onRowClick) {
        props.onRowClick({
          traceFullDetailedEvent: props.transaction,
          event: embeddedChildren,
          openPanel,
        });
      }
    }
  }, [isHighlighted, embeddedChildren, props, props.transaction, openPanel]);

  const renderEmbeddedChildrenState = () => {
    if (showEmbeddedChildren) {
      if (isEmbeddedChildrenLoading) {
        return (
          <MessageRow>
            <span>{t('Loading embedded transaction')}</span>
          </MessageRow>
        );
      }

      if (embeddedChildrenError) {
        return (
          <MessageRow>
            <span>{t('Error loading embedded transaction')}</span>
          </MessageRow>
        );
      }
    }

    return null;
  };

  const handleRowCellClick = () => {
    const {transaction, organization, location} = props;

    if (isTraceError(transaction)) {
      navigate(generateIssueEventTarget(transaction, organization));
      return;
    }

    if (isTraceTransaction<TraceFullDetailed>(transaction)) {
      navigate(
        {
          ...location,
          hash: transactionTargetHash(transaction.event_id),
          query: {
            ...location.query,
            openPanel: 'open',
          },
        },
        {replace: true}
      );
    }
  };

  const getCurrentOffset = () => {
    const {transaction} = props;
    const {generation} = transaction;

    return getOffset(generation);
  };

  const renderMeasurements = () => {
    const {measurements, generateBounds} = props;
    if (!measurements) {
      return null;
    }

    return (
      <Fragment>
        {Array.from(measurements.values()).map(verticalMark => {
          const mark = Object.values(verticalMark.marks)[0];
          const {timestamp} = mark;
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
  };

  const renderConnector = (hasToggle: boolean) => {
    const {continuingDepths, isExpanded, isOrphan, isLast, transaction} = props;

    const {generation = 0} = transaction;
    const eventId =
      isTraceTransaction<TraceFullDetailed>(transaction) || isTraceError(transaction)
        ? transaction.event_id
        : transaction.traceSlug;

    if (generation === 0) {
      if (hasToggle) {
        return (
          <ConnectorBar
            style={{right: '15px', height: '10px', bottom: '-5px', top: 'auto'}}
            orphanBranch={false}
          />
        );
      }
      return null;
    }

    const connectorBars: Array<React.ReactNode> = continuingDepths.map(
      ({depth, isOrphanDepth}) => {
        if (generation - depth <= 1) {
          // If the difference is less than or equal to 1, then it means that the continued
          // bar is from its direct parent. In this case, do not render a connector bar
          // because the tree connector below will suffice.
          return null;
        }

        const left = -1 * getOffset(generation - depth - 1) - 2;

        return (
          <ConnectorBar
            style={{left}}
            key={`${eventId}-${depth}`}
            orphanBranch={isOrphanDepth}
          />
        );
      }
    );

    const embeddedChildrenLength =
      (embeddedChildren && waterfallModel && waterfallModel.rootSpan.children.length) ??
      0;
    if (
      hasToggle &&
      (isExpanded || (showEmbeddedChildren && embeddedChildrenLength > 0))
    ) {
      connectorBars.push(
        <ConnectorBar
          style={{
            right: '15px',
            height: '10px',
            bottom: isLast ? `-${ROW_HEIGHT / 2 + 1}px` : '0',
            top: 'auto',
          }}
          key={`${eventId}-last`}
          orphanBranch={false}
        />
      );
    }

    return (
      <TreeConnector isLast={isLast} hasToggler={hasToggle} orphanBranch={isOrphan}>
        {connectorBars}
      </TreeConnector>
    );
  };

  const renderEmbeddedTransactionsBadge = (): React.ReactNode => {
    return (
      <Tooltip
        title={
          <span>
            {showEmbeddedChildren
              ? t(
                  'This transaction is showing a direct child. Remove transaction to hide'
                )
              : t('This transaction has a direct child. Add transaction to view')}
          </span>
        }
        position="top"
        containerDisplayMode="block"
        delay={400}
      >
        <StyledZoomIcon
          isZoomIn={!showEmbeddedChildren}
          onClick={() => {
            setShowEmbeddedChildren(prev => !prev);

            if (
              (props.isExpanded && !showEmbeddedChildren) ||
              (!props.isExpanded && showEmbeddedChildren)
            ) {
              props.toggleExpandedState();
            }
          }}
        />
      </Tooltip>
    );
  };

  const renderEmbeddedChildren = () => {
    if (!embeddedChildren || !showEmbeddedChildren || !waterfallModel) {
      return null;
    }

    const {
      organization,
      traceViewRef,
      location,
      isLast,
      traceInfo,
      isExpanded,
      toggleExpandedState,
    } = props;
    const profileId = embeddedChildren.contexts?.profile?.profile_id ?? null;

    if (isExpanded) {
      toggleExpandedState();
    }

    return (
      <Fragment>
        <QuickTraceQuery
          event={embeddedChildren}
          location={location}
          orgSlug={organization.slug}
          skipLight={false}
        >
          {results => (
            <ProfilesProvider
              orgSlug={organization.slug}
              projectSlug={embeddedChildren.projectSlug ?? ''}
              profileId={profileId || ''}
            >
              <ProfileContext.Consumer>
                {profiles => (
                  <ProfileGroupProvider
                    type="flamechart"
                    input={profiles?.type === 'resolved' ? profiles.data : null}
                    traceID={profileId || ''}
                  >
                    <SpanContext.Provider>
                      <SpanContext.Consumer>
                        {spanContextProps => (
                          <Observer>
                            {() => (
                              <NewTraceDetailsSpanTree
                                measurements={props.measurements}
                                quickTrace={results}
                                location={props.location}
                                onRowClick={props.onRowClick}
                                traceInfo={traceInfo}
                                traceViewHeaderRef={traceViewRef}
                                traceViewRef={traceViewRef}
                                parentContinuingDepths={props.continuingDepths}
                                traceHasMultipleRoots={props.continuingDepths.some(
                                  c => c.depth === 0 && c.isOrphanDepth
                                )}
                                parentIsOrphan={props.isOrphan}
                                parentIsLast={isLast}
                                parentGeneration={transaction.generation ?? 0}
                                organization={organization}
                                waterfallModel={waterfallModel}
                                filterSpans={waterfallModel.filterSpans}
                                spans={waterfallModel
                                  .getWaterfall({
                                    viewStart: 0,
                                    viewEnd: 1,
                                  })
                                  .slice(1)}
                                focusedSpanIds={waterfallModel.focusedSpanIds}
                                spanContextProps={spanContextProps}
                                operationNameFilters={waterfallModel.operationNameFilters}
                              />
                            )}
                          </Observer>
                        )}
                      </SpanContext.Consumer>
                    </SpanContext.Provider>
                  </ProfileGroupProvider>
                )}
              </ProfileContext.Consumer>
            </ProfilesProvider>
          )}
        </QuickTraceQuery>
      </Fragment>
    );
  };

  const renderToggle = (errored: boolean) => {
    const {isExpanded, transaction, toggleExpandedState, numOfOrphanErrors} = props;
    const left = getCurrentOffset();

    const hasOrphanErrors = numOfOrphanErrors && numOfOrphanErrors > 0;
    let childrenLength: number | string =
      (!isTraceError(transaction) && transaction.children?.length) || 0;
    const generation = transaction.generation || 0;
    if (childrenLength <= 0 && !hasOrphanErrors && !showEmbeddedChildren) {
      return (
        <TreeToggleContainer style={{left: `${left}px`}}>
          {renderConnector(false)}
        </TreeToggleContainer>
      );
    }

    if (showEmbeddedChildren) {
      childrenLength =
        embeddedChildren && waterfallModel
          ? waterfallModel.rootSpan.children.length
          : '?';
    } else {
      childrenLength = childrenLength + (numOfOrphanErrors ?? 0);
    }

    const isRoot = generation === 0;

    return (
      <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {renderConnector(true)}
        <TreeToggle
          disabled={isRoot}
          isExpanded={isExpanded}
          errored={errored}
          onClick={event => {
            event.stopPropagation();

            if (isRoot || showEmbeddedChildren) {
              return;
            }

            toggleExpandedState();
            setShowEmbeddedChildren(false);
          }}
        >
          <span>{childrenLength}</span>
          {!isRoot && !showEmbeddedChildren && (
            <div>
              <TreeToggleIcon direction={isExpanded ? 'up' : 'down'} />
            </div>
          )}
        </TreeToggle>
      </TreeToggleContainer>
    );
  };

  const renderTitle = (_: ScrollbarManager.ScrollbarManagerChildrenProps) => {
    const {organization, transaction, addContentSpanBarRef, removeContentSpanBarRef} =
      props;
    const left = getCurrentOffset();
    const errored = isTraceTransaction<TraceFullDetailed>(transaction)
      ? transaction.errors &&
        transaction.errors.length + transaction.performance_issues.length > 0
      : false;

    const projectBadge = (isTraceTransaction<TraceFullDetailed>(transaction) ||
      isTraceError(transaction)) && (
      <Projects orgId={organization.slug} slugs={[transaction.project_slug]}>
        {({projects}) => {
          const project = projects.find(p => p.slug === transaction.project_slug);
          return (
            <ProjectBadgeContainer>
              <Tooltip title={transaction.project_slug}>
                <ProjectBadge
                  project={project ? project : {slug: transaction.project_slug}}
                  avatarSize={16}
                  hideName
                />
              </Tooltip>
            </ProjectBadgeContainer>
          );
        }}
      </Projects>
    );

    const content = isTraceError(transaction) ? (
      <Fragment>
        {projectBadge}
        <RowTitleContent errored>
          <ErrorLink to={generateIssueEventTarget(transaction, organization)}>
            <strong>{'Unknown \u2014 '}</strong>
            {shortenErrorTitle(transaction.title)}
          </ErrorLink>
        </RowTitleContent>
      </Fragment>
    ) : isTraceTransaction<TraceFullDetailed>(transaction) ? (
      <Fragment>
        {projectBadge}
        <RowTitleContent errored={errored}>
          <strong>
            {transaction['transaction.op']}
            {' \u2014 '}
          </strong>
          {transaction.transaction}
        </RowTitleContent>
      </Fragment>
    ) : (
      <RowTitleContent errored={false}>
        <strong>{'Trace \u2014 '}</strong>
        {transaction.traceSlug}
      </RowTitleContent>
    );

    return (
      <RowTitleContainer
        ref={ref => {
          if (!ref) {
            removeContentSpanBarRef(spanContentRef);
            return;
          }

          addContentSpanBarRef(ref);
          spanContentRef = ref;
        }}
      >
        {renderToggle(errored)}
        <RowTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          {content}
        </RowTitle>
      </RowTitleContainer>
    );
  };

  const renderDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    if (isHighlighted) {
      // Mock component to preserve layout spacing
      return (
        <DividerLine
          showDetail={isHighlighted}
          style={{
            position: 'absolute',
          }}
        />
      );
    }

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
        onMouseDown={e => {
          dividerHandlerChildrenProps.onDragStart(e);
        }}
        onClick={event => {
          // we prevent the propagation of the clicks from this component to prevent
          // the span detail from being opened.
          event.stopPropagation();
        }}
      />
    );
  };

  const renderGhostDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;

    return (
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
          onClick={event => {
            // the ghost divider line should not be interactive.
            // we prevent the propagation of the clicks from this component to prevent
            // the span detail from being opened.
            event.stopPropagation();
          }}
        />
      </DividerLineGhostContainer>
    );
  };

  const renderErrorBadge = () => {
    const {transaction} = props;

    if (
      isTraceRoot(transaction) ||
      isTraceError(transaction) ||
      !(transaction.errors.length + transaction.performance_issues.length)
    ) {
      return null;
    }

    return <ErrorBadge />;
  };

  const renderMetricsBadge = () => {
    const {organization} = props;
    const hasMetrics = Object.keys(embeddedChildren?._metrics_summary ?? {}).length > 0;

    if (
      !hasMetricsExperimentalFeature(organization) ||
      isTraceRoot(transaction) ||
      isTraceError(transaction) ||
      !hasMetrics
    ) {
      return null;
    }

    return <MetricsBadge />;
  };

  const renderRectangle = () => {
    const {transaction, traceInfo, barColor} = props;

    // Use 1 as the difference in the case that startTimestamp === endTimestamp
    const delta = Math.abs(traceInfo.endTimestamp - traceInfo.startTimestamp) || 1;
    const start_timestamp = isTraceError(transaction)
      ? transaction.timestamp
      : transaction.start_timestamp;

    if (!(start_timestamp && transaction.timestamp)) {
      return null;
    }

    const startPosition = Math.abs(start_timestamp - traceInfo.startTimestamp);
    const startPercentage = startPosition / delta;
    const duration = Math.abs(transaction.timestamp - start_timestamp);
    const widthPercentage = duration / delta;

    return (
      <StyledRowRectangle
        style={{
          backgroundColor: barColor,
          left: `min(${toPercent(startPercentage || 0)}, calc(100% - 1px))`,
          width: toPercent(widthPercentage || 0),
        }}
      >
        {renderPerformanceIssues()}
        {isTraceError(transaction) ? (
          <ErrorBadge />
        ) : (
          <Fragment>
            {renderMetricsBadge()}
            {renderErrorBadge()}
            <DurationPill
              durationDisplay={getDurationDisplay({
                left: startPercentage,
                width: widthPercentage,
              })}
              showDetail={isHighlighted}
            >
              {getHumanDuration(duration)}
            </DurationPill>
          </Fragment>
        )}
      </StyledRowRectangle>
    );
  };

  const renderPerformanceIssues = () => {
    const {transaction, barColor} = props;
    if (isTraceError(transaction) || isTraceRoot(transaction)) {
      return null;
    }

    const rows: React.ReactElement[] = [];
    // Use 1 as the difference in the case that startTimestamp === endTimestamp
    const delta = Math.abs(transaction.timestamp - transaction.start_timestamp) || 1;
    for (let i = 0; i < transaction.performance_issues.length; i++) {
      const issue = transaction.performance_issues[i];
      const startPosition = Math.abs(issue.start - transaction.start_timestamp);
      const startPercentage = startPosition / delta;
      const duration = Math.abs(issue.end - issue.start);
      const widthPercentage = duration / delta;
      rows.push(
        <RowRectangle
          style={{
            backgroundColor: barColor,
            left: `min(${toPercent(startPercentage || 0)}, calc(100% - 1px))`,
            width: toPercent(widthPercentage || 0),
          }}
          spanBarType={SpanBarType.AFFECTED}
        />
      );
    }
    return rows;
  };

  const renderHeader = ({
    dividerHandlerChildrenProps,
    scrollbarManagerChildrenProps,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
    scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps;
  }) => {
    const {hasGuideAnchor, index, transaction, onlyOrphanErrors = false} = props;
    const {dividerPosition} = dividerHandlerChildrenProps;
    const hideDurationRectangle = isTraceRoot(transaction) && onlyOrphanErrors;

    return (
      <RowCellContainer showDetail={isHighlighted}>
        <RowCell
          data-test-id="transaction-row-title"
          data-type="span-row-cell"
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
            paddingTop: 0,
          }}
          showDetail={isHighlighted}
          onClick={handleRowCellClick}
          ref={transactionTitleRef}
        >
          <GuideAnchor target="trace_view_guide_row" disabled={!hasGuideAnchor}>
            {renderTitle(scrollbarManagerChildrenProps)}
          </GuideAnchor>
        </RowCell>
        <DividerContainer>
          {renderDivider(dividerHandlerChildrenProps)}
          {!isTraceRoot(transaction) &&
            !isTraceError(transaction) &&
            renderEmbeddedTransactionsBadge()}
        </DividerContainer>
        <RowCell
          data-test-id="transaction-row-duration"
          data-type="span-row-cell"
          showStriping={index % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
            paddingTop: 0,
            overflow: 'visible',
          }}
          showDetail={isHighlighted}
          onClick={handleRowCellClick}
        >
          <RowReplayTimeIndicators />
          <GuideAnchor target="trace_view_guide_row_details" disabled={!hasGuideAnchor}>
            {!hideDurationRectangle && renderRectangle()}
            {renderMeasurements()}
          </GuideAnchor>
        </RowCell>
        {!isHighlighted && renderGhostDivider(dividerHandlerChildrenProps)}
      </RowCellContainer>
    );
  };

  const {isVisible, transaction} = props;

  return (
    <div>
      <StyledRow
        ref={transactionRowDOMRef}
        visible={isVisible}
        showBorder={isHighlighted}
        cursor={
          isTraceTransaction<TraceFullDetailed>(transaction) ? 'pointer' : 'default'
        }
      >
        <ScrollbarManager.Consumer>
          {scrollbarManagerChildrenProps => (
            <DividerHandlerManager.Consumer>
              {dividerHandlerChildrenProps =>
                renderHeader({
                  dividerHandlerChildrenProps,
                  scrollbarManagerChildrenProps,
                })
              }
            </DividerHandlerManager.Consumer>
          )}
        </ScrollbarManager.Consumer>
      </StyledRow>
      {renderEmbeddedChildrenState()}
      {renderEmbeddedChildren()}
    </div>
  );
}

function getOffset(generation) {
  return generation * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;
}

export default NewTraceDetailsTransactionBar;

const StyledRow = styled(Row)`
  &,
  ${RowCellContainer} {
    overflow: visible;
  }
`;

const ErrorLink = styled(Link)`
  color: ${p => p.theme.error};
`;

const StyledRowRectangle = styled(RowRectangle)`
  display: flex;
  align-items: center;
`;

export const StyledZoomIcon = styled(IconZoom)`
  position: absolute;
  left: -20px;
  top: 4px;
  height: 16px;
  width: 18px;
  z-index: 1000;
  background: ${p => p.theme.background};
  padding: 1px;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${space(0.5)};
`;
