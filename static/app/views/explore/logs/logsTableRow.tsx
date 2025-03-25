import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';

import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TableRow} from 'sentry/views/explore/components/table';
import {
  useLogsAnalyticsPageSource,
  useLogsFields,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {HiddenLogDetailFields} from 'sentry/views/explore/logs/constants';
import {
  LogAttributesRendererMap,
  LogBodyRenderer,
  LogFieldRenderer,
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

export function LogRowContent({
  dataRow,
  highlightTerms,
  meta,
  sharedHoverTimeoutRef,
}: LogsRowProps) {
  const location = useLocation();
  const organization = useOrganization();
  const fields = useLogsFields();
  const analyticsPageSource = useLogsAnalyticsPageSource();
  const [expanded, setExpanded] = useState<boolean>(false);
  const onClickExpand = useCallback(() => {
    setExpanded(e => !e);
    trackAnalytics('logs.table.row_expanded', {
      log_id: String(dataRow[OurLogKnownFieldKey.ID]),
      page_source: analyticsPageSource,
      organization,
    });
  }, [dataRow, organization, analyticsPageSource]);
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
    sharedHoverTimeoutRef,
  });

  return (
    <Fragment>
      <LogTableRow onClick={onClickExpand} {...hoverProps}>
        {fields.map((field, index) => {
          const value = dataRow[field];
          const isFirstColumn = index === 0;
          const rendererExtra = {
            highlightTerms,
            logColors,
            useFullSeverityText: false,
            renderSeverityCircle: true,
            wrapBody: false,
            location,
            organization,
          };

          if (!defined(value)) {
            return null;
          }

          if (isFirstColumn) {
            return (
              <LogTableBodyCell key={field}>
                <LogFirstCellContent>
                  <StyledChevronButton
                    icon={
                      <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
                    }
                    aria-label={t('Toggle trace details')}
                    aria-expanded={expanded}
                    size="zero"
                    borderless
                  />

                  <LogFieldRenderer
                    item={getLogRowItem(field, dataRow, meta)}
                    meta={meta}
                    extra={rendererExtra}
                  />
                </LogFirstCellContent>
              </LogTableBodyCell>
            );
          }

          return (
            <LogTableBodyCell key={field}>
              <LogFieldRenderer
                item={getLogRowItem(field, dataRow, meta)}
                meta={meta}
                extra={rendererExtra}
              />
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
    log_id: String(dataRow[OurLogKnownFieldKey.ID] ?? ''),
    project_id: String(dataRow[OurLogKnownFieldKey.PROJECT_ID] ?? ''),
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
