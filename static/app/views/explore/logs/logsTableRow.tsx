import {Fragment, useCallback, useState} from 'react';
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
import CellAction, {Actions} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {TableRow} from 'sentry/views/explore/components/table';
import {
  useLogsAnalyticsPageSource,
  useLogsFields,
  useLogsSearch,
  useSetLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {HiddenLogDetailFields} from 'sentry/views/explore/logs/constants';
import {
  LogAttributesRendererMap,
  LogBodyRenderer,
  LogFieldRenderer,
  SeverityCircleRenderer,
} from 'sentry/views/explore/logs/fieldRenderers';
import {LogFieldsTree} from 'sentry/views/explore/logs/logFieldsTree';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  useExploreLogsTableRow,
  usePrefetchLogTableRowOnHover,
} from 'sentry/views/explore/logs/useLogsQuery';

import {
  DetailsFooter,
  DetailsGrid,
  DetailsWrapper,
  getLogColors,
  LogDetailsTitle,
  LogDetailTableBodyCell,
  LogFirstCellContent,
  LogsTableBodyFirstCell,
  LogTableBodyCell,
  LogTableRow,
  StyledChevronButton,
} from './styles';
import {getLogRowItem, getLogSeverityLevel} from './utils';

type LogsRowProps = {
  dataRow: OurLogsResponseItem;
  highlightTerms: string[];
  meta: EventsMetaType | undefined;
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
};

const ALLOWED_CELL_ACTIONS: Actions[] = [Actions.ADD, Actions.EXCLUDE];

export function LogRowContent({
  dataRow,
  highlightTerms,
  meta,
  sharedHoverTimeoutRef,
}: LogsRowProps) {
  const location = useLocation();
  const organization = useOrganization();
  const fields = useLogsFields();
  const search = useLogsSearch();
  const setLogsSearch = useSetLogsSearch();

  function onPointerUp() {
    if (window.getSelection()?.toString() === '') {
      setExpanded(e => !e);
      trackAnalytics('logs.table.row_expanded', {
        log_id: String(dataRow[OurLogKnownFieldKey.ID]),
        page_source: analyticsPageSource,
        organization,
      });
    }
  }

  const analyticsPageSource = useLogsAnalyticsPageSource();
  const [expanded, setExpanded] = useState<boolean>(false);
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
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY_TEXT];

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
  };

  return (
    <Fragment>
      <LogTableRow onPointerUp={onPointerUp} onTouchEnd={onPointerUp} {...hoverProps}>
        <LogsTableBodyFirstCell key={'first'}>
          <LogFirstCellContent>
            <StyledChevronButton
              icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
              aria-label={t('Toggle trace details')}
              aria-expanded={expanded}
              size="zero"
              borderless
            />
            <SeverityCircleRenderer
              extra={rendererExtra}
              meta={meta}
              tableResultLogRow={dataRow}
            />
          </LogFirstCellContent>
        </LogsTableBodyFirstCell>
        {fields.map(field => {
          const value = dataRow[field];

          if (!defined(value)) {
            return null;
          }

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
            <LogTableBodyCell key={field}>
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
                    default:
                      break;
                  }
                }}
                allowActions={
                  field === OurLogKnownFieldKey.BODY ? ALLOWED_CELL_ACTIONS : []
                }
              >
                <LogFieldRenderer
                  item={getLogRowItem(field, dataRow, meta)}
                  meta={meta}
                  extra={rendererExtra}
                />
              </CellAction>
            </LogTableBodyCell>
          );
        })}
      </LogTableRow>
      {expanded && (
        <LogRowDetails dataRow={dataRow} highlightTerms={highlightTerms} meta={meta} />
      )}
    </Fragment>
  );
}

function LogRowDetails({
  dataRow,
  highlightTerms,
  meta,
}: {
  dataRow: OurLogsResponseItem;
  highlightTerms: string[];
  meta: EventsMetaType | undefined;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const fields = useLogsFields();
  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY_TEXT];

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const missingLogId = !dataRow[OurLogKnownFieldKey.ID];
  const {data, isPending} = useExploreLogsTableRow({
    logId: String(dataRow[OurLogKnownFieldKey.ID] ?? ''),
    projectId: String(dataRow[OurLogKnownFieldKey.PROJECT_ID] ?? ''),
    traceId: String(dataRow[OurLogKnownFieldKey.TRACE_ID] ?? ''),
    enabled: !missingLogId,
  });

  const theme = useTheme();
  const logColors = getLogColors(level, theme);

  if (missingLogId) {
    return (
      <DetailsWrapper>
        <EmptyStreamWrapper>
          <IconWarning color="gray300" size="lg" />
        </EmptyStreamWrapper>
      </DetailsWrapper>
    );
  }
  return (
    <DetailsWrapper>
      <TableRow>
        <LogDetailTableBodyCell colSpan={fields.length}>
          {isPending && <LoadingIndicator />}
          {!isPending && data && (
            <Fragment>
              <DetailsGrid>
                <LogDetailsTitle>{t('Log')}</LogDetailsTitle>
                <LogFieldsTree
                  attributes={data.attributes}
                  hiddenAttributes={HiddenLogDetailFields}
                  renderers={LogAttributesRendererMap}
                  renderExtra={{
                    highlightTerms,
                    logColors,
                    location,
                    organization,
                  }}
                />
              </DetailsGrid>
              <DetailsFooter logColors={logColors}>
                {LogBodyRenderer({
                  item: getLogRowItem(OurLogKnownFieldKey.BODY, dataRow, meta),
                  extra: {
                    highlightTerms,
                    logColors,
                    wrapBody: true,
                    location,
                    organization,
                  },
                })}
              </DetailsFooter>
            </Fragment>
          )}
        </LogDetailTableBodyCell>
      </TableRow>
    </DetailsWrapper>
  );
}
