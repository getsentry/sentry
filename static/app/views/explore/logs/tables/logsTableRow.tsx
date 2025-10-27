import type {ComponentProps, SyntheticEvent} from 'react';
import {Fragment, memo, useCallback, useLayoutEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import classNames from 'classnames';
import omit from 'lodash/omit';

import {Button} from 'sentry/components/core/button';
import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconAdd, IconJson, IconSubtract, IconWarning} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {FieldValueType} from 'sentry/utils/fields';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import useProjects from 'sentry/utils/useProjects';
import CellAction, {
  Actions,
  ActionTriggerType,
  copyToClipboard,
} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  useLogsAutoRefreshEnabled,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useFetchTraceItemDetailsOnHover} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  AlwaysPresentLogFields,
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
  StyledChevronButton,
} from 'sentry/views/explore/logs/styles';
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
  ourlogToJson,
} from 'sentry/views/explore/logs/utils';
import type {ReplayEmbeddedTableOptions} from 'sentry/views/explore/logs/utils/logsReplayUtils';
import {
  useAddSearchFilter,
  useQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

type LogsRowProps = {
  dataRow: OurLogsResponseItem;
  highlightTerms: string[];
  meta: EventsMetaType | undefined;
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  blockRowExpanding?: boolean;
  canDeferRenderElements?: boolean;
  embedded?: boolean;
  embeddedOptions?: {
    openWithExpandedIds?: string[];
    replay?: ReplayEmbeddedTableOptions;
  };
  isExpanded?: boolean;
  logEnd?: string;
  logStart?: string;
  onCollapse?: (logItemId: string) => void;
  /**
   * This should only be used in embedded views since we won't be opening the details.
   */
  onEmbeddedRowClick?: (logItemId: string, event: React.MouseEvent) => void;
  onExpand?: (logItemId: string) => void;
  onExpandHeight?: (logItemId: string, estimatedHeight: number) => void;
};

const ALLOWED_CELL_ACTIONS: Actions[] = [
  Actions.ADD,
  Actions.EXCLUDE,
  Actions.COPY_TO_CLIPBOARD,
];

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
  onExpandHeight,
  blockRowExpanding,
  canDeferRenderElements,
  onEmbeddedRowClick,
  logStart,
  logEnd,
}: LogsRowProps) {
  const location = useLocation();
  const organization = useOrganization();
  const fields = useQueryParamsFields();
  const projects = useProjects();

  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const setAutorefresh = useSetLogsAutoRefresh();
  const measureRef = useRef<HTMLTableRowElement>(null);
  const [shouldRenderHoverElements, _setShouldRenderHoverElements] = useState(
    canDeferRenderElements ? false : true
  );

  const setShouldRenderHoverElements = useCallback(
    (value: boolean) => {
      if (canDeferRenderElements) {
        _setShouldRenderHoverElements(value);
      }
    },
    [canDeferRenderElements, _setShouldRenderHoverElements]
  );

  // This only applies in embedded views where clicking doesn't expand row details.
  function onClick(event: SyntheticEvent) {
    if (onEmbeddedRowClick && event.nativeEvent instanceof MouseEvent) {
      event.preventDefault();
      onEmbeddedRowClick(
        String(dataRow[OurLogKnownFieldKey.ID]),
        event as React.MouseEvent
      );
      return;
    }
  }

  function onPointerUp(event: SyntheticEvent) {
    if (event.target instanceof Element && isInsideButton(event.target)) {
      // do not expand the context menu if you clicked a button
      return;
    }
    if (window.getSelection()?.toString() === '') {
      toggleExpanded();
    }
  }

  const analyticsPageSource = useLogsAnalyticsPageSource();
  const [_expanded, setExpanded] = useState<boolean>(false);
  const expanded = isExpanded ?? _expanded;

  function toggleExpanded() {
    if (onExpand) {
      if (isExpanded) {
        onCollapse?.(String(dataRow[OurLogKnownFieldKey.ID]));
      } else {
        onExpand?.(String(dataRow[OurLogKnownFieldKey.ID]));
      }
    } else {
      setExpanded(e => !e);
    }
    if (!isExpanded && autorefreshEnabled) {
      setAutorefresh('paused');
    }

    trackAnalytics('logs.table.row_expanded', {
      log_id: String(dataRow[OurLogKnownFieldKey.ID]),
      page_source: analyticsPageSource,
      organization,
    });
  }

  useLayoutEffect(() => {
    if (measureRef.current && isExpanded) {
      onExpandHeight?.(
        String(dataRow[OurLogKnownFieldKey.ID]),
        measureRef.current.clientHeight
      );
    }
  }, [isExpanded, onExpandHeight, dataRow]);

  const addSearchFilter = useAddSearchFilter();
  const theme = useTheme();

  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY];
  const projectId: (typeof AlwaysPresentLogFields)[1] =
    dataRow[OurLogKnownFieldKey.PROJECT_ID];
  const project = projects.projects.find(p => p.id === '' + projectId);
  const projectSlug = project?.slug ?? '';

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const logColors = getLogColors(level, theme);
  const prefetchTimeout = autorefreshEnabled
    ? DEFAULT_TRACE_ITEM_HOVER_TIMEOUT_WITH_AUTO_REFRESH
    : DEFAULT_TRACE_ITEM_HOVER_TIMEOUT;
  const {hoverProps, traceItemsResult} = useFetchTraceItemDetailsOnHover({
    traceItemId: String(dataRow[OurLogKnownFieldKey.ID]),
    projectId: String(dataRow[OurLogKnownFieldKey.PROJECT_ID]),
    traceId: String(dataRow[OurLogKnownFieldKey.TRACE_ID]),
    traceItemType: TraceItemDataset.LOGS,
    referrer: 'api.explore.log-item-details',
    sharedHoverTimeoutRef,
    timeout: prefetchTimeout,
  });

  const rendererExtra: RendererExtra = {
    highlightTerms,
    logColors,
    useFullSeverityText: false,
    location,
    organization,
    attributes: dataRow,
    attributeTypes: meta?.fields ?? {},
    theme,
    projectSlug,
    meta,
    project,
    traceItemMeta: traceItemsResult?.data?.meta,
    timestampRelativeTo: embeddedOptions?.replay?.timestampRelativeTo,
    onReplayTimeClick: embeddedOptions?.replay?.onReplayTimeClick,
    logStart,
    logEnd,
  };

  const rowInteractProps: ComponentProps<typeof LogTableRow> = blockRowExpanding
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
    embeddedOptions.replay.timestampRelativeTo
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
        {...omit(rowInteractProps, 'className')}
        className={classNames(rowInteractProps.className, replayTimeClasses)}
        onMouseEnter={e => {
          setShouldRenderHoverElements(true);
          if (rowInteractProps.onMouseEnter) {
            rowInteractProps.onMouseEnter(e);
          }
        }}
      >
        <LogsTableBodyFirstCell key="first">
          <LogFirstCellContent>
            {blockRowExpanding ? null : shouldRenderHoverElements ? (
              <StyledChevronButton
                icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
                aria-label={t('Toggle trace details')}
                aria-expanded={expanded}
                size="zero"
                borderless
                onClick={() => toggleExpanded()}
              />
            ) : (
              <span className="log-table-row-chevron-button">{chevronIcon}</span>
            )}
            <SeverityCircleRenderer extra={rendererExtra} meta={meta} />
            {project ? <ProjectBadge project={project} avatarSize={12} hideName /> : null}
          </LogFirstCellContent>
        </LogsTableBodyFirstCell>
        {fields?.map(field => {
          const value = dataRow[field];

          if (!defined(value)) {
            return <LogTableBodyCell key={field} />;
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

          const discoverColumn: TableColumn<keyof TableDataRow> = {
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
            <LogTableBodyCell key={field} data-test-id={'log-table-cell-' + field}>
              {shouldRenderHoverElements ? (
                <CellAction
                  column={discoverColumn}
                  dataRow={dataRow as unknown as TableDataRow}
                  handleCellAction={(actions, cellValue) => {
                    switch (actions) {
                      case Actions.ADD:
                        addSearchFilter({
                          key: field,
                          value: cellValue,
                        });
                        break;
                      case Actions.EXCLUDE:
                        addSearchFilter({
                          key: field,
                          value: cellValue,
                          negated: true,
                        });
                        break;
                      case Actions.COPY_TO_CLIPBOARD:
                        copyToClipboard(cellValue);
                        break;
                      default:
                        break;
                    }
                  }}
                  allowActions={
                    field === OurLogKnownFieldKey.TIMESTAMP || embedded
                      ? []
                      : ALLOWED_CELL_ACTIONS
                  }
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
  const organization = useOrganization();
  const project = useProjectFromId({
    project_id: '' + dataRow[OurLogKnownFieldKey.PROJECT_ID],
  });
  const projectSlug = project?.slug ?? '';
  const fields = useQueryParamsFields();
  const getActions = useLogAttributesTreeActions({embedded});
  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY];

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const missingLogId = !dataRow[OurLogKnownFieldKey.ID];
  const fullLogDataResult = useExploreLogsTableRow({
    logId: String(dataRow[OurLogKnownFieldKey.ID] ?? ''),
    projectId: String(dataRow[OurLogKnownFieldKey.PROJECT_ID] ?? ''),
    traceId: String(dataRow[OurLogKnownFieldKey.TRACE_ID] ?? ''),
    enabled: !missingLogId,
  });

  const {data, isPending, isError} = fullLogDataResult;

  const theme = useTheme();
  const logColors = getLogColors(level, theme);
  const attributes =
    data?.attributes?.reduce((it, {name, value}) => ({...it, [name]: value}), {
      [OurLogKnownFieldKey.TIMESTAMP]: dataRow[OurLogKnownFieldKey.TIMESTAMP],
    }) ?? {};
  const attributeTypes =
    data?.attributes?.reduce((it, {name, type}) => ({...it, [name]: type}), {}) ?? {};

  if (missingLogId || isError) {
    return (
      <DetailsWrapper ref={ref}>
        <EmptyStreamWrapper>
          <IconWarning color="gray300" size="lg" />
        </EmptyStreamWrapper>
      </DetailsWrapper>
    );
  }

  const colSpan = fields.length + 1; // Number of dynamic fields + first cell which is always rendered.

  return (
    <DetailsWrapper ref={isPending ? undefined : ref}>
      <LogDetailTableBodyCell colSpan={colSpan}>
        {isPending && <LoadingIndicator />}
        {!isPending && data && (
          <Fragment>
            <DetailsContent>
              <DetailsBody>
                {LogBodyRenderer({
                  item: getLogRowItem(OurLogKnownFieldKey.MESSAGE, dataRow, meta),
                  extra: {
                    highlightTerms,
                    logColors,
                    wrapBody: true,
                    location,
                    organization,
                    projectSlug,
                    attributes,
                    attributeTypes,
                    meta,
                    theme,
                    traceItemMeta: data?.meta,
                  },
                })}
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
                    highlightTerms,
                    logColors,
                    location,
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
            tableDataRow={dataRow}
          />
        </LogDetailTableActionsCell>
      )}
    </DetailsWrapper>
  );
}

function LogRowDetailsFilterActions({tableDataRow}: {tableDataRow: OurLogsResponseItem}) {
  const addSearchFilter = useAddSearchFilter();
  return (
    <LogDetailTableActionsButtonBar>
      <Button
        priority="link"
        size="sm"
        borderless
        onClick={() => {
          addSearchFilter({
            key: OurLogKnownFieldKey.MESSAGE,
            value: tableDataRow[OurLogKnownFieldKey.MESSAGE],
          });
        }}
      >
        <IconAdd size="md" style={{paddingRight: space(0.5)}} />
        {t('Add to filter')}
      </Button>
      <Button
        priority="link"
        size="sm"
        borderless
        onClick={() => {
          addSearchFilter({
            key: OurLogKnownFieldKey.MESSAGE,
            value: tableDataRow[OurLogKnownFieldKey.MESSAGE],
            negated: true,
          });
        }}
      >
        <IconSubtract size="md" style={{paddingRight: space(0.5)}} />
        {t('Exclude from filter')}
      </Button>
    </LogDetailTableActionsButtonBar>
  );
}

function LogRowDetailsActions({
  fullLogDataResult,
  tableDataRow,
}: {
  fullLogDataResult: UseApiQueryResult<TraceItemDetailsResponse, RequestError>;
  tableDataRow: OurLogsResponseItem;
}) {
  const {data, isPending, isError} = fullLogDataResult;
  const isFrozen = useLogsFrozenIsFrozen();
  const organization = useOrganization();
  const showFilterButtons = !isFrozen;

  const {onClick: betterCopyToClipboard} = useCopyToClipboard({
    text: isPending || isError ? '' : ourlogToJson(data),
    onCopy: () => {
      trackAnalytics('logs.table.row_copied_as_json', {
        log_id: String(tableDataRow[OurLogKnownFieldKey.ID]),
        organization,
      });
    },

    successMessage: t('Copied!'),
    errorMessage: t('Failed to copy'),
  });
  return (
    <Fragment>
      {showFilterButtons ? (
        <LogRowDetailsFilterActions tableDataRow={tableDataRow} />
      ) : (
        <span />
      )}
      <LogDetailTableActionsButtonBar>
        <Button
          priority="link"
          size="sm"
          borderless
          onClick={() => {
            betterCopyToClipboard();
          }}
        >
          <IconJson size="md" style={{paddingRight: space(0.5)}} />
          {t('Copy as JSON')}
        </Button>
      </LogDetailTableActionsButtonBar>
    </Fragment>
  );
}
