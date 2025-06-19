import type {ComponentProps, SyntheticEvent} from 'react';
import {Fragment, memo, useCallback, useLayoutEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {FieldValueType} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import CellAction, {
  Actions,
  copyToClipBoard,
} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  useLogsAnalyticsPageSource,
  useLogsBlockRowExpanding,
  useLogsFields,
  useLogsIsTableFrozen,
  useLogsSearch,
  useSetLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {HiddenLogDetailFields} from 'sentry/views/explore/logs/constants';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {
  LogAttributesRendererMap,
  LogBodyRenderer,
  LogFieldRenderer,
  SeverityCircleRenderer,
} from 'sentry/views/explore/logs/fieldRenderers';
import {
  DetailsBody,
  DetailsContent,
  DetailsWrapper,
  getLogColors,
  LogAttributeTreeWrapper,
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
import {
  useExploreLogsTableRow,
  usePrefetchLogTableRowOnHover,
} from 'sentry/views/explore/logs/useLogsQuery';
import {
  adjustAliases,
  getLogRowItem,
  getLogSeverityLevel,
} from 'sentry/views/explore/logs/utils';

type LogsRowProps = {
  dataRow: OurLogsResponseItem;
  highlightTerms: string[];
  meta: EventsMetaType | undefined;
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  canDeferRenderElements?: boolean;
  isExpanded?: boolean;
  onCollapse?: (logItemId: string) => void;
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
  highlightTerms,
  meta,
  sharedHoverTimeoutRef,
  isExpanded,
  onExpand,
  onCollapse,
  onExpandHeight,
  canDeferRenderElements,
}: LogsRowProps) {
  const location = useLocation();
  const organization = useOrganization();
  const fields = useLogsFields();
  const search = useLogsSearch();
  const setLogsSearch = useSetLogsSearch();
  const isTableFrozen = useLogsIsTableFrozen();
  const blockRowExpanding = useLogsBlockRowExpanding();
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

  const addSearchFilter = useCallback(
    ({
      key,
      value,
      negated,
    }: {
      key: string;
      value: string | number | boolean;
      negated?: boolean;
    }) => {
      const newSearch = search.copy();
      newSearch.addFilterValue(`${negated ? '!' : ''}${key}`, String(value));
      setLogsSearch(newSearch);
    },
    [setLogsSearch, search]
  );
  const theme = useTheme();

  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY];
  const project = useProjectFromId({
    project_id: '' + dataRow[OurLogKnownFieldKey.PROJECT_ID],
  });
  const projectSlug = project?.slug ?? '';

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const logColors = getLogColors(level, theme);
  const hoverProps = usePrefetchLogTableRowOnHover({
    logId: String(dataRow[OurLogKnownFieldKey.ID]),
    projectId: String(dataRow[OurLogKnownFieldKey.PROJECT_ID]),
    traceId: String(dataRow[OurLogKnownFieldKey.TRACE_ID]),
    sharedHoverTimeoutRef,
  });

  const rendererExtra = {
    highlightTerms,
    logColors,
    useFullSeverityText: false,
    renderSeverityCircle: true,
    location,
    organization,
    attributes: dataRow,
    theme,
    projectSlug,
  };

  const rowInteractProps: ComponentProps<typeof LogTableRow> = blockRowExpanding
    ? {}
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

  return (
    <Fragment>
      <LogTableRow
        data-test-id="log-table-row"
        {...rowInteractProps}
        onMouseEnter={() => setShouldRenderHoverElements(true)}
        onMouseLeave={() => setShouldRenderHoverElements(false)}
      >
        <LogsTableBodyFirstCell key={'first'}>
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
              extra={rendererExtra}
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
                        copyToClipBoard(cellValue);
                        break;
                      default:
                        break;
                    }
                  }}
                  allowActions={
                    field === OurLogKnownFieldKey.TIMESTAMP || isTableFrozen
                      ? []
                      : ALLOWED_CELL_ACTIONS
                  }
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
          meta={meta}
          ref={measureRef}
        />
      )}
    </Fragment>
  );
});

function LogRowDetails({
  dataRow,
  highlightTerms,
  meta,
  ref,
}: {
  dataRow: OurLogsResponseItem;
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
  const fields = useLogsFields();
  const getActions = useLogAttributesTreeActions();
  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY];

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const missingLogId = !dataRow[OurLogKnownFieldKey.ID];
  const {data, isPending, isError} = useExploreLogsTableRow({
    logId: String(dataRow[OurLogKnownFieldKey.ID] ?? ''),
    projectId: String(dataRow[OurLogKnownFieldKey.PROJECT_ID] ?? ''),
    traceId: String(dataRow[OurLogKnownFieldKey.TRACE_ID] ?? ''),
    enabled: !missingLogId,
  });

  const theme = useTheme();
  const logColors = getLogColors(level, theme);
  const attributes =
    data?.attributes?.reduce((it, {name, value}) => ({...it, [name]: value}), {
      [OurLogKnownFieldKey.TIMESTAMP]: dataRow[OurLogKnownFieldKey.TIMESTAMP],
    }) ?? {};

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
                    theme,
                  },
                })}
              </DetailsBody>
              <LogAttributeTreeWrapper>
                <AttributesTree<RendererExtra>
                  attributes={data.attributes}
                  hiddenAttributes={HiddenLogDetailFields}
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
                    theme,
                  }}
                />
              </LogAttributeTreeWrapper>
            </DetailsContent>
          </Fragment>
        )}
      </LogDetailTableBodyCell>
    </DetailsWrapper>
  );
}
