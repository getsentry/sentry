import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';

import EmptyStateWarning, {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {LOGS_PROPS_DOCS_URL} from 'sentry/constants';
import {IconArrow, IconWarning} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  useLogsCursor,
  useLogsSearch,
  useLogsSortBys,
  useSetLogsCursor,
  useSetLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  bodyRenderer,
  HiddenLogAttributes,
  LogAttributesRendererMap,
  severityTextRenderer,
  TimestampRenderer,
} from 'sentry/views/explore/logs/fieldRenderers';
import {LogFieldsTree} from 'sentry/views/explore/logs/logFieldsTree';
import {
  type OurLogFieldKey,
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  useExploreLogsTable,
  useExploreLogsTableRow,
} from 'sentry/views/explore/logs/useLogsQuery';
import {EmptyStateText} from 'sentry/views/traces/styles';

import {
  DetailsFooter,
  DetailsGrid,
  DetailsWrapper,
  getLogColors,
  HeaderCell,
  LogDetailsTitle,
  LogPanelContent,
  StyledChevronButton,
  StyledPanel,
  StyledPanelItem,
} from './styles';
import {getLogBodySearchTerms, getLogSeverityLevel} from './utils';

type LogsRowProps = {
  dataRow: OurLogsResponseItem;
  highlightTerms: string[];
};

export function LogsTable() {
  const search = useLogsSearch();
  const cursor = useLogsCursor();
  const setCursor = useSetLogsCursor();
  const {data, isError, isPending, pageLinks} = useExploreLogsTable({
    limit: 100,
    search,
    cursor,
  });

  const isEmpty = !isPending && !isError && (data?.length ?? 0) === 0;
  const highlightTerms = getLogBodySearchTerms(search);
  const sortBys = useLogsSortBys();
  const setSortBys = useSetLogsSortBys();

  const headers: Array<{align: 'left' | 'right'; field: OurLogFieldKey; label: string}> =
    [
      {field: OurLogKnownFieldKey.SEVERITY_NUMBER, label: t('Severity'), align: 'left'},
      {field: OurLogKnownFieldKey.BODY, label: t('Message'), align: 'left'},
      {field: OurLogKnownFieldKey.TIMESTAMP, label: t('Timestamp'), align: 'right'},
    ];

  return (
    <Fragment>
      <StyledPanel>
        <LogPanelContent>
          {headers.map((header, index) => {
            const direction = sortBys.find(s => s.field === header.field)?.kind;
            return (
              <HeaderCell
                key={index}
                align={header.align}
                lightText
                onClick={() => setSortBys([{field: header.field}])}
              >
                {header.label}
                {defined(direction) && (
                  <IconArrow
                    size="xs"
                    direction={
                      direction === 'desc'
                        ? 'down'
                        : direction === 'asc'
                          ? 'up'
                          : undefined
                    }
                  />
                )}
              </HeaderCell>
            );
          })}
          {isPending && (
            <StyledPanelItem span={3} overflow>
              <LoadingIndicator />
            </StyledPanelItem>
          )}
          {isError && (
            <StyledPanelItem span={3} overflow>
              <EmptyStreamWrapper>
                <IconWarning color="gray300" size="lg" />
              </EmptyStreamWrapper>
            </StyledPanelItem>
          )}
          {isEmpty && (
            <StyledPanelItem span={3} overflow>
              <EmptyStateWarning withIcon>
                <EmptyStateText size="fontSizeExtraLarge">
                  {t('No logs found')}
                </EmptyStateText>
                <EmptyStateText size="fontSizeMedium">
                  {tct('Try adjusting your filters or refer to [docSearchProps].', {
                    docSearchProps: (
                      <ExternalLink href={LOGS_PROPS_DOCS_URL}>
                        {t('docs for search properties')}
                      </ExternalLink>
                    ),
                  })}
                </EmptyStateText>
              </EmptyStateWarning>
            </StyledPanelItem>
          )}
          {data?.map((row, index) => (
            <LogsRow key={index} dataRow={row} highlightTerms={highlightTerms} />
          ))}
        </LogPanelContent>
      </StyledPanel>
      <Pagination pageLinks={pageLinks} onCursor={setCursor} />
    </Fragment>
  );
}

function LogsRow({dataRow, highlightTerms}: LogsRowProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const onClickExpand = useCallback(() => setExpanded(e => !e), [setExpanded]);
  const theme = useTheme();

  const severityNumber = dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityText = dataRow[OurLogKnownFieldKey.SEVERITY_TEXT];

  const level = getLogSeverityLevel(
    typeof severityNumber === 'number' ? severityNumber : null,
    typeof severityText === 'string' ? severityText : null
  );
  const logColors = getLogColors(level, theme);

  return (
    <Fragment>
      <StyledPanelItem align="left" center onClick={onClickExpand}>
        <StyledChevronButton
          icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
          aria-label={t('Toggle trace details')}
          aria-expanded={expanded}
          size="zero"
          borderless
        />
        {severityTextRenderer({
          attribute_value: severityText,
          tableResultLogRow: dataRow,
          extra: {
            highlightTerms,
            logColors,
            useFullSeverityText: false,
            renderSeverityCircle: true,
          },
        })}
      </StyledPanelItem>
      <StyledPanelItem overflow>
        {bodyRenderer({
          attribute_value: dataRow[OurLogKnownFieldKey.BODY],
          extra: {
            highlightTerms,
            logColors,
            wrapBody: false,
          },
        })}
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <TimestampRenderer
          attribute_value={dataRow[OurLogKnownFieldKey.TIMESTAMP]}
          extra={{
            highlightTerms,
            logColors,
          }}
        />
      </StyledPanelItem>
      {expanded && <LogDetails dataRow={dataRow} highlightTerms={highlightTerms} />}
    </Fragment>
  );
}

function LogDetails({
  dataRow,
  highlightTerms,
}: {
  dataRow: OurLogsResponseItem;
  highlightTerms: string[];
}) {
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
      <DetailsWrapper span={3}>
        <EmptyStreamWrapper>
          <IconWarning color="gray300" size="lg" />
        </EmptyStreamWrapper>
      </DetailsWrapper>
    );
  }
  return (
    <DetailsWrapper span={3}>
      {isPending && <LoadingIndicator />}
      {!isPending && data && (
        <Fragment>
          <DetailsGrid>
            <LogDetailsTitle>{t('Log')}</LogDetailsTitle>
            <LogFieldsTree
              attributes={data.attributes}
              hiddenAttributes={HiddenLogAttributes}
              renderers={LogAttributesRendererMap}
              renderExtra={{
                highlightTerms,
                logColors,
              }}
            />
          </DetailsGrid>
          <DetailsFooter logColors={logColors}>
            {bodyRenderer({
              attribute_value: dataRow[OurLogKnownFieldKey.BODY],
              extra: {
                highlightTerms,
                logColors,
                wrapBody: true,
              },
            })}
          </DetailsFooter>
        </Fragment>
      )}
    </DetailsWrapper>
  );
}
