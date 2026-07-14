import type {ComponentProps, SyntheticEvent} from 'react';
import {Fragment, memo, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {UseQueryResult} from '@tanstack/react-query';
import classNames from 'classnames';
import omit from 'lodash/omit';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {
  IconAdd,
  IconJson,
  IconPin,
  IconSubtract,
  IconTerminal,
  IconWarning,
} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {escapeDoubleQuotes} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {normalizeTimestampToSeconds} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {FieldValueType} from 'sentry/utils/fields';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {
  Actions,
  ActionTriggerType,
  CellAction,
  copyToClipboard,
} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  useLogsAutoRefreshEnabled,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {
  LOGS_QUERY_KEY,
  LOGS_ROW_ID_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {
  TraceItemDetailsResponse,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  usePrefetchTraceItemDetailsOnHover,
  usePrefetchTraceItemDetailsOnMount,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  DEFAULT_TRACE_ITEM_HOVER_TIMEOUT,
  DEFAULT_TRACE_ITEM_HOVER_TIMEOUT_WITH_AUTO_REFRESH,
  HiddenLogDetailFields,
} from 'sentry/views/explore/logs/constants';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {
  LogAttributesRendererMap,
  LogBodyRenderer,
  LogFieldRenderer,
  SeverityCircleRenderer,
} from 'sentry/views/explore/logs/fieldRenderers';
import {useLogsFrozenIsFrozen} from 'sentry/views/explore/logs/logsFrozenContext';
import {useLogsAnalyticsPageSource} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {
  DetailsBody,
  DetailsContent,
  DetailsWrapper,
  getLogColors,
  LogAttributeTreeWrapper,
  LogDetailTableActionsButtonBar,
  LogDetailTableActionsCell,
  LogDetailTableBodyCell,
  LogFirstCellContent,
  LogsTableBodyFirstCell,
  LogTableBodyCell,
  LogTableRow,
  LogPinButton,
  StyledChevronButton,
  TraceIconStyleWrapper,
} from 'sentry/views/explore/logs/styles';
import {
  getMessageFilter,
  type MessageFilter,
} from 'sentry/views/explore/logs/tables/getMessageFilter';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useLogAttributesTreeActions} from 'sentry/views/explore/logs/useLogAttributesTreeActions';
import {useExploreLogsTableRow} from 'sentry/views/explore/logs/useLogsQuery';
import {
  adjustAliases,
  getLogRowItem,
  getLogRowTimestampMillis,
  getLogSeverityLevel,
  isPseudoLogResponseItem,
  isRegularLogResponseItem,
  ourlogToJson,
} from 'sentry/views/explore/logs/utils';
import type {ReplayEmbeddedTableOptions} from 'sentry/views/explore/logs/utils/logsReplayUtils';
import {
  useAddSearchFilter,
  useQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';

type LogsRowProps = {
  dataRow: OurLogsResponseItem;
  highlightTerms: string[];
  meta: EventsMetaType | undefined;
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  blockRowExpanding?: boolean;
  embedded?: boolean;
  embeddedOptions?: {
    openWithExpandedIds?: string[];
    replay?: ReplayEmbeddedTableOptions;
  };
  expansionKey?: string;
  isExpanded?: boolean;
  isHighlighted?: boolean;
  isHoverLinked?: boolean;
  isPinned?: boolean;
  logEnd?: string;
  logStart?: string;
  onCollapse?: (logItemId: string) => void;
  onEmbeddedRowClick?: (logItemId: string, event: React.MouseEvent) => void;
  onExpand?: (logItemId: string) => void;
  onExpandHeight?: (logItemId: string, estimatedHeight: number) => void;
  setHoveredRowId?: (logItemId: string | null) => void;
  showCellActions?: boolean;
  showExploreSimilarSpansLink?: boolean;
  togglePinnedRow?: (logItemId: string) => void;
};

const ALLOWED_CELL_ACTIONS: Actions[] = [
  Actions.ADD,
  Actions.EXCLUDE,
  Actions.COPY_TO_CLIPBOARD,
  Actions.COPY_LINK,
];
const EXPLORE_SIMILAR_SPANS_REFERRER = 'trace-logs-table-similar-spans';

function getExploreSimilarSpansMenuItems({
  message,
  organization,
  selection,
  showExploreSimilarSpansLink,
}: {
  message: string | number | null | undefined;
  organization: Organization;
  selection: PageFilters;
  showExploreSimilarSpansLink?: boolean;
}): MenuItemProps[] | undefined {
  const messageString = String(message ?? '');

  if (!showExploreSimilarSpansLink || messageString.length === 0) {
    return undefined;
  }

  return [
    {
      key: 'explore-similar-spans',
      label: t('Explore similar spans'),
      to: getExploreUrl({
        organization,
        selection: {
          ...selection,
          datetime: {
            period: '24h',
            start: null,
            end: null,
            utc: selection.datetime.utc,
          },
        },
        mode: Mode.SAMPLES,
        referrer: EXPLORE_SIMILAR_SPANS_REFERRER,
        crossEvents: [
          {
            type: 'logs',
            query: `${OurLogKnownFieldKey.MESSAGE}:"${escapeDoubleQuotes(messageString)}"`,
          },
        ],
      }),
    },
  ];
}

function isInsideButton(element: Element | null): boolean {
  let i = 10;
  while (element && i > 0) {
    i -= 1;
    if (
      element instanceof HTMLButtonElement ||
      element.getAttribute('role') === 'button'
    ) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

export const LogRowContent = memo(function LogRowContent({
  dataRow,
  embedded = false,
  embeddedOptions,
  highlightTerms,
  meta,
  sharedHoverTimeoutRef,
  isExpanded,
  onExpand,
  onCollapse,
  expansionKey: expansionKeyProp,
  onExpandHeight,
  blockRowExpanding,
  onEmbeddedRowClick,
  logStart,
  logEnd,
  isPinned,
  isHoverLinked,
  isHighlighted,
  setHoveredRowId,
  togglePinnedRow,
  showCellActions,
  showExploreSimilarSpansLink,
}: LogsRowProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const fields = useQueryParamsFields();
  const projects = useProjects();

  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const setAutorefresh = useSetLogsAutoRefresh();
  const isFrozen = useLogsFrozenIsFrozen();
  const measureRef = useRef<HTMLTableRowElement>(null);

  const rowId = String(dataRow[OurLogKnownFieldKey.ID]);
  const expansionKey = expansionKeyProp ?? rowId;

  const [shouldRenderHoverElements, setShouldRenderHoverElements] = useState(isPinned);

  // This only applies in embedded views where clicking doesn't expand row details.
  function onClick(event: SyntheticEvent) {
    if (onEmbeddedRowClick && event.nativeEvent instanceof MouseEvent) {
      event.preventDefault();
      onEmbeddedRowClick(rowId, event as React.MouseEvent);
      return;
    }
  }

  function onPointerUp(event: SyntheticEvent) {
    // do not expand the context menu if...
    if (event.target instanceof Element) {
      // ... you clicked a button
      if (isInsideButton(event.target)) {
        return;
      }

      // ... you clicked outside the row (e.g. a portal button)
      if (
        !(event.currentTarget instanceof Node) ||
        !event.currentTarget.contains(event.target)
      ) {
        return;
      }
    }

    if (window.getSelection()?.toString() === '') {
      toggleExpanded();
    }
  }

  const analyticsPageSource = useLogsAnalyticsPageSource();
  const [_expanded, setExpanded] = useState(false);
  const expanded = isExpanded ?? _expanded;
  const isPseudoRow = isPseudoLogResponseItem(dataRow);

  function toggleExpanded() {
    if (onExpand) {
      if (isExpanded) {
        onCollapse?.(expansionKey);
      } else {
        onExpand?.(expansionKey);
      }
    } else {
      setExpanded(e => !e);
    }
    if (!isExpanded && autorefreshEnabled) {
      setAutorefresh('paused');
    }

    trackAnalytics('logs.table.row_expanded', {
      log_id: rowId,
      page_source: analyticsPageSource,
      organization,
    });
  }

  useLayoutEffect(() => {
    if (measureRef.current && isExpanded) {
      onExpandHeight?.(expansionKey, measureRef.current.clientHeight);
    }
  }, [expansionKey, isExpanded, onExpandHeight]);

  const addSearchFilter = useAddSearchFilter();
  const {copy} = useCopyToClipboard();
  const theme = useTheme();

  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY];
  const projectId = dataRow[OurLogKnownFieldKey.PROJECT_ID];
  const project = projects.projects.find(p => p.id === String(projectId));
  const projectSlug = project?.slug ?? '';

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const logColors = getLogColors(level, theme);
  const prefetchTimeout = autorefreshEnabled
    ? DEFAULT_TRACE_ITEM_HOVER_TIMEOUT_WITH_AUTO_REFRESH
    : DEFAULT_TRACE_ITEM_HOVER_TIMEOUT;
  const logTimestampSeconds = isRegularLogResponseItem(dataRow)
    ? getLogRowTimestampMillis(dataRow) / 1000
    : null;
  const {hoverProps, prefetch, isProjectReady, traceItemMeta, traceItemAttributes} =
    usePrefetchTraceItemDetailsOnHover({
      traceItemId: rowId,
      projectId: String(dataRow[OurLogKnownFieldKey.PROJECT_ID]),
      traceId: String(dataRow[OurLogKnownFieldKey.TRACE_ID]),
      traceItemType: TraceItemDataset.LOGS,
      referrer: 'api.explore.log-item-details',
      timestamp: logTimestampSeconds,
      sharedHoverTimeoutRef,
      timeout: prefetchTimeout,
    });
  usePrefetchTraceItemDetailsOnMount({
    prefetch,
    enabled: isHighlighted,
    isProjectReady,
  });
  const [caseInsensitivity] = useCaseInsensitivity();

  const observedTimestamp = traceItemAttributes?.find(
    a => a.name === 'sentry.observed_timestamp_nanos'
  );

  const rendererExtra: RendererExtra = {
    highlightTerms,
    caseSensitiveHighlighting: !caseInsensitivity,
    logColors,
    useFullSeverityText: false,
    location,
    navigate,
    organization,
    attributes: {
      ...dataRow,
      ...(observedTimestamp && {
        [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: String(observedTimestamp.value),
      }),
    } as OurLogsResponseItem,
    attributeTypes: meta?.fields ?? {},
    theme,
    projectSlug,
    meta,
    project,
    traceItemMeta,
    timestampRelativeTo: embeddedOptions?.replay?.timestampRelativeTo,
    onReplayTimeClick: embeddedOptions?.replay?.onReplayTimeClick,
    logStart,
    logEnd,
  };

  const rowInteractProps: ComponentProps<typeof LogTableRow> = isPseudoRow
    ? {isClickable: false}
    : blockRowExpanding
      ? onEmbeddedRowClick
        ? {onClick, isClickable: true}
        : {}
      : {
          ...hoverProps,
          onPointerUp,
          onTouchEnd: onPointerUp,
          isClickable: true,
        };

  const buttonSize = 'xs';
  const chevronIcon = (
    <IconChevron size={buttonSize} direction={expanded ? 'down' : 'right'} />
  );

  let replayTimeClasses = {};
  if (
    embeddedOptions?.replay?.displayReplayTimeIndicator &&
    embeddedOptions.replay.timestampRelativeTo &&
    isRegularLogResponseItem(dataRow)
  ) {
    const logTimestamp = getLogRowTimestampMillis(dataRow);
    const offsetMs = logTimestamp - embeddedOptions.replay.timestampRelativeTo;

    const currentTime = embeddedOptions.replay.currentTime ?? 0;
    const currentHoverTime = embeddedOptions.replay.currentHoverTime;

    const hasOccurred = currentTime >= offsetMs;
    const isBeforeHover = currentHoverTime === undefined || currentHoverTime >= offsetMs;

    replayTimeClasses = {
      beforeCurrentTime: hasOccurred,
      afterCurrentTime: !hasOccurred,
      beforeHoverTime: currentHoverTime !== undefined && isBeforeHover,
      afterHoverTime: currentHoverTime !== undefined && !isBeforeHover,
    };
  }

  return (
    <Fragment>
      <LogTableRow
        data-test-id="log-table-row"
        data-row-hover-linked={isHoverLinked}
        data-row-linked={isHighlighted}
        highlighted={isPseudoRow}
        pinned={isPinned}
        {...omit(rowInteractProps, 'className')}
        className={classNames(rowInteractProps.className, replayTimeClasses)}
        onMouseEnter={e => {
          setShouldRenderHoverElements(true);
          rowInteractProps.onMouseEnter?.(e);
          if (isPinned) {
            setHoveredRowId?.(rowId);
          }
        }}
        onMouseLeave={e => {
          rowInteractProps.onMouseLeave?.(e);
          if (isPinned) {
            setHoveredRowId?.(null);
          }
        }}
      >
        <LogsTableBodyFirstCell key="first">
          <LogFirstCellContent>
            {isPseudoRow ? (
              <span className="log-table-row-pseudo-row-chevron-replacement" />
            ) : blockRowExpanding ? null : shouldRenderHoverElements ? (
              <StyledChevronButton
                icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
                aria-label={t('Toggle trace details')}
                aria-expanded={expanded}
                size="zero"
                variant="transparent"
                onClick={() => toggleExpanded()}
              />
            ) : (
              <span className="log-table-row-chevron-button">{chevronIcon}</span>
            )}
            {isPseudoRow ? (
              <Flex align="center" justify="center" gap="sm">
                <TraceIconStyleWrapper>
                  <div className="TraceIcon error">
                    <TraceIcons.Fire />
                  </div>
                </TraceIconStyleWrapper>
              </Flex>
            ) : (
              <Fragment>
                <SeverityCircleRenderer extra={rendererExtra} meta={meta} />
                {project ? (
                  <ProjectBadge project={project} avatarSize={12} hideName />
                ) : null}
              </Fragment>
            )}
          </LogFirstCellContent>
        </LogsTableBodyFirstCell>
        {fields?.map((field, index) => {
          const pin =
            togglePinnedRow && index === fields.length - 1 ? (
              <LogPinButton
                aria-label={isPinned ? t('Unpin log row') : t('Pin log row')}
                icon={
                  <IconPin isSolid={isPinned} variant={isPinned ? 'accent' : 'primary'} />
                }
                isPinned={isPinned}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  togglePinnedRow(dataRow[OurLogKnownFieldKey.ID]);
                }}
                size="xs"
                variant="transparent"
              />
            ) : null;

          const shouldRenderActions =
            (showCellActions ?? !embedded) && shouldRenderHoverElements;

          const value = dataRow[field];

          const extraMenuItems =
            field === OurLogKnownFieldKey.MESSAGE
              ? getExploreSimilarSpansMenuItems({
                  message: value,
                  organization,
                  selection,
                  showExploreSimilarSpansLink,
                })
              : undefined;

          if (!defined(value)) {
            return (
              <LogTableBodyCell key={field} reservePinGutter={!!pin}>
                {shouldRenderActions ? (
                  <Flex position="relative" height="100%" width="100%" justify="end">
                    {pin}
                  </Flex>
                ) : null}
              </LogTableBodyCell>
            );
          }

          const renderedField = (
            <LogFieldRenderer
              item={getLogRowItem(field, dataRow, meta)}
              meta={meta}
              extra={{
                ...rendererExtra,
                canAppendTemplateToBody: true,
                unit: meta?.units?.[field],
              }}
            />
          );

          const discoverColumn: TableColumn<keyof OurLogsResponseItem> = {
            column: {
              field,
              kind: 'field',
            },
            name: field,
            key: field,
            isSortable: true,
            type: FieldValueType.STRING,
          };

          return (
            <LogTableBodyCell
              key={field}
              data-test-id={'log-table-cell-' + field}
              reservePinGutter={!!pin}
            >
              {shouldRenderActions ? (
                <CellAction
                  column={discoverColumn}
                  dataRow={dataRow}
                  handleCellAction={(actions, cellValue) => {
                    const filter = getMessageFilter(field, dataRow, cellValue);
                    switch (actions) {
                      case Actions.ADD:
                        addSearchFilter({
                          key: filter.key,
                          value: filter.value,
                        });
                        break;
                      case Actions.EXCLUDE:
                        addSearchFilter({
                          key: filter.key,
                          value: filter.value,
                          negated: true,
                        });
                        break;
                      case Actions.COPY_TO_CLIPBOARD:
                        copyToClipboard(cellValue);
                        break;
                      case Actions.COPY_LINK: {
                        const logId = String(dataRow[OurLogKnownFieldKey.ID]);
                        const url = new URL(window.location.origin + location.pathname);
                        const params = new URLSearchParams(location.search);
                        // In frozen/embedded views (e.g. trace details) the row set is
                        // bounded, so link to the row and let it highlight + expand in
                        // context. On the standalone logs page the row may not be loaded,
                        // so filter to it instead.
                        if (isFrozen) {
                          params.set(LOGS_ROW_ID_KEY, logId);
                        } else {
                          params.set(LOGS_QUERY_KEY, `id:${logId}`);
                          params.delete(LOGS_ROW_ID_KEY);
                        }
                        url.search = params.toString();
                        copy(url.toString(), {
                          successMessage: t('Copied!'),
                          errorMessage: t('Failed to copy'),
                        }).then(() => {
                          trackAnalytics('logs.table.row_link_copied', {
                            log_id: logId,
                            organization,
                          });
                        });
                        break;
                      }
                      default:
                        break;
                    }
                  }}
                  allowActions={ALLOWED_CELL_ACTIONS}
                  extraMenuItems={extraMenuItems}
                  pin={pin}
                  triggerType={ActionTriggerType.ELLIPSIS}
                >
                  {renderedField}
                </CellAction>
              ) : (
                renderedField
              )}
            </LogTableBodyCell>
          );
        })}
      </LogTableRow>
      {expanded && (
        <LogRowDetails
          dataRow={dataRow}
          highlightTerms={highlightTerms}
          embedded={embedded}
          meta={meta}
          ref={measureRef}
        />
      )}
    </Fragment>
  );
});

function LogRowDetails({
  dataRow,
  embedded,
  highlightTerms,
  meta,
  ref,
}: {
  dataRow: OurLogsResponseItem;
  embedded: boolean;
  highlightTerms: string[];
  meta: EventsMetaType | undefined;
  ref: React.RefObject<HTMLTableRowElement | null>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const project = useProjectFromId({
    project_id: '' + dataRow[OurLogKnownFieldKey.PROJECT_ID],
  });
  const projectSlug = project?.slug ?? '';
  const fields = useQueryParamsFields();
  const getActions = useLogAttributesTreeActions({embedded});
  const [caseInsensitivity] = useCaseInsensitivity();
  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY];

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const missingLogId = !dataRow[OurLogKnownFieldKey.ID];
  const isPseudoRow = isPseudoLogResponseItem(dataRow);
  const fullLogDataResult = useExploreLogsTableRow({
    logId: String(dataRow[OurLogKnownFieldKey.ID] ?? ''),
    projectId: String(dataRow[OurLogKnownFieldKey.PROJECT_ID] ?? ''),
    traceId: String(dataRow[OurLogKnownFieldKey.TRACE_ID] ?? ''),
    timestamp: isRegularLogResponseItem(dataRow)
      ? getLogRowTimestampMillis(dataRow) / 1000
      : null,
    enabled: !missingLogId && !isPseudoRow,
  });

  const {data, isPending, isError} = fullLogDataResult;

  const theme = useTheme();
  const logColors = getLogColors(level, theme);
  const attributes =
    data?.attributes?.reduce<Record<string, TraceItemResponseAttribute['value']>>(
      (it, attr) => {
        it[attr.name] = attr.value;
        return it;
      },
      {
        [OurLogKnownFieldKey.TIMESTAMP]: dataRow[OurLogKnownFieldKey.TIMESTAMP],
      }
    ) ?? {};
  const attributeTypes =
    data?.attributes?.reduce<Record<string, TraceItemResponseAttribute['type']>>(
      (it, attr) => {
        it[attr.name] = attr.type;
        return it;
      },
      {}
    ) ?? {};

  if (missingLogId || isError) {
    return (
      <DetailsWrapper ref={ref}>
        <EmptyStreamWrapper>
          <IconWarning variant="muted" size="lg" />
        </EmptyStreamWrapper>
      </DetailsWrapper>
    );
  }

  const colSpan = fields.length + 1; // Number of dynamic fields + first cell which is always rendered.
  const message = String(
    attributes[OurLogKnownFieldKey.MESSAGE] ?? dataRow[OurLogKnownFieldKey.MESSAGE] ?? ''
  );

  return (
    <DetailsWrapper ref={isPending ? undefined : ref}>
      <LogDetailTableBodyCell colSpan={colSpan}>
        {isPending && <LoadingIndicator />}
        {!isPending && data && (
          <Fragment>
            <DetailsContent>
              <DetailsBody>
                {isRegularLogResponseItem(dataRow) ? (
                  <LogBodyRenderer
                    item={{
                      ...getLogRowItem(OurLogKnownFieldKey.MESSAGE, dataRow, meta),
                      value: message,
                    }}
                    extra={{
                      highlightTerms,
                      logColors,
                      wrapBody: true,
                      location,
                      navigate,
                      organization,
                      caseSensitiveHighlighting: !caseInsensitivity,
                      projectSlug,
                      attributes,
                      attributeTypes,
                      meta,
                      theme,
                      traceItemMeta: data?.meta,
                    }}
                  />
                ) : (
                  <span>{message}</span>
                )}
              </DetailsBody>
              <LogAttributeTreeWrapper>
                <AttributesTree<RendererExtra>
                  attributes={data.attributes.filter(
                    attribute => !HiddenLogDetailFields.includes(attribute.name)
                  )}
                  getCustomActions={getActions}
                  getAdjustedAttributeKey={adjustAliases}
                  renderers={LogAttributesRendererMap}
                  rendererExtra={{
                    caseSensitiveHighlighting: !caseInsensitivity,
                    highlightTerms,
                    logColors,
                    location,
                    navigate,
                    organization,
                    projectSlug,
                    attributes,
                    attributeTypes,
                    theme,
                    meta,
                    project,
                    traceItemMeta: data?.meta,
                    disableLazyLoad: true, // We disable lazy loading in the log details view since a user has to open it first.
                  }}
                />
              </LogAttributeTreeWrapper>
            </DetailsContent>
          </Fragment>
        )}
      </LogDetailTableBodyCell>
      {!isPending && data && (
        <LogDetailTableActionsCell
          colSpan={colSpan}
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            flexDirection: 'row',
          }}
        >
          <LogRowDetailsActions
            fullLogDataResult={fullLogDataResult}
            projectSlug={projectSlug}
            tableDataRow={dataRow}
          />
        </LogDetailTableActionsCell>
      )}
    </DetailsWrapper>
  );
}

function LogRowDetailsFilterActions({filter}: {filter: MessageFilter}) {
  const addSearchFilter = useAddSearchFilter();
  return (
    <LogDetailTableActionsButtonBar>
      <Button
        variant="transparent"
        size="sm"
        icon={<IconAdd />}
        onClick={() => {
          addSearchFilter({
            key: filter.key,
            value: filter.value,
          });
        }}
      >
        {t('Add to filter')}
      </Button>
      <Button
        variant="transparent"
        size="sm"
        icon={<IconSubtract />}
        onClick={() => {
          addSearchFilter({
            key: filter.key,
            value: filter.value,
            negated: true,
          });
        }}
      >
        {t('Exclude from filter')}
      </Button>
    </LogDetailTableActionsButtonBar>
  );
}

function LogRowDetailsActions({
  fullLogDataResult,
  projectSlug,
  tableDataRow,
}: {
  fullLogDataResult: UseQueryResult<TraceItemDetailsResponse>;
  projectSlug: string;
  tableDataRow: OurLogsResponseItem;
}) {
  const {data, isPending, isError} = fullLogDataResult;
  const isFrozen = useLogsFrozenIsFrozen();
  const organization = useOrganization();
  const user = useUser();
  const showFilterButtons = !isFrozen;
  const message = String(
    data?.attributes?.find(attr => attr.name === OurLogKnownFieldKey.MESSAGE)?.value ??
      tableDataRow[OurLogKnownFieldKey.MESSAGE] ??
      ''
  );
  const messageFilter = getMessageFilter(
    OurLogKnownFieldKey.MESSAGE,
    tableDataRow,
    message
  );

  const {copy} = useCopyToClipboard();

  // Memoize in case we are attempting to copy large JSON objects.
  const json = useMemo(() => ourlogToJson(data), [data]);
  let logDebugEndpoint: string | undefined;

  if (user.isSuperuser && projectSlug && isRegularLogResponseItem(tableDataRow)) {
    const logId = tableDataRow[OurLogKnownFieldKey.ID] ?? '';
    const traceId = tableDataRow[OurLogKnownFieldKey.TRACE_ID] ?? '';

    if (logId && traceId) {
      const query = new URLSearchParams({
        item_type: TraceItemDataset.LOGS,
        trace_id: traceId,
        debug: 'true',
        timestamp: String(
          normalizeTimestampToSeconds(getLogRowTimestampMillis(tableDataRow))
        ),
      });

      logDebugEndpoint = `/api/0${getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/trace-items/$itemId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug,
            itemId: logId,
          },
        }
      )}?${query}`;
    }
  }

  const betterCopyToClipboard = () => {
    if (!json) {
      return;
    }
    copy(json, {
      successMessage: t('Copied!'),
      errorMessage: t('Failed to copy'),
    }).then(() => {
      trackAnalytics('logs.table.row_copied_as_json', {
        log_id: String(tableDataRow[OurLogKnownFieldKey.ID]),
        organization,
      });
    });
  };

  return (
    <Fragment>
      {showFilterButtons ? (
        <LogRowDetailsFilterActions filter={messageFilter} />
      ) : (
        <span />
      )}
      <LogDetailTableActionsButtonBar>
        <Button
          variant="transparent"
          size="sm"
          icon={<IconJson />}
          onClick={betterCopyToClipboard}
          disabled={isPending || isError || !json}
        >
          {t('Copy as JSON')}
        </Button>
        {logDebugEndpoint ? (
          <LinkButton
            variant="transparent"
            size="sm"
            href={logDebugEndpoint}
            icon={<IconTerminal />}
          >
            {t('Debug JSON')}
          </LinkButton>
        ) : null}
      </LogDetailTableActionsButtonBar>
    </Fragment>
  );
}
