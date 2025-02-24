import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';

import EmptyStateWarning, {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {LOGS_PROPS_DOCS_URL} from 'sentry/constants';
import {IconArrow, IconWarning} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  useLogsSearch,
  useLogsSortBys,
  useSetLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  bodyRenderer,
  severityCircleRenderer,
  severityTextRenderer,
  TimestampRenderer,
} from 'sentry/views/explore/logs/fieldRenderers';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {EmptyStateText} from 'sentry/views/traces/styles';

import {
  DetailsFooter,
  DetailsGrid,
  DetailsLabel,
  DetailsSubGrid,
  DetailsValue,
  DetailsWrapper,
  getLogColors,
  HeaderCell,
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
  const {data, isError, isPending} = useExploreLogsTable({
    limit: 100,
    search,
  });

  const isEmpty = !isPending && !isError && (data?.length ?? 0) === 0;
  const highlightTerms = getLogBodySearchTerms(search);
  const sortBys = useLogsSortBys();
  const setSortBys = useSetLogsSortBys();

  const headers: Array<{align: 'left' | 'right'; field: string; label: string}> = [
    {field: 'log.severity_number', label: t('Severity'), align: 'left'},
    {field: 'log.body', label: t('Message'), align: 'left'},
    {field: 'timestamp', label: t('Timestamp'), align: 'right'},
  ];

  return (
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
                    direction === 'desc' ? 'down' : direction === 'asc' ? 'up' : undefined
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
  );
}

function LogsRow({dataRow, highlightTerms}: LogsRowProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const onClickExpand = useCallback(() => setExpanded(e => !e), [setExpanded]);
  const theme = useTheme();
  const level = getLogSeverityLevel(
    dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER],
    dataRow[OurLogKnownFieldKey.SEVERITY_TEXT]
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
        {severityCircleRenderer(
          dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER],
          dataRow[OurLogKnownFieldKey.SEVERITY_TEXT],
          logColors
        )}
        {severityTextRenderer(
          dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER],
          dataRow[OurLogKnownFieldKey.SEVERITY_TEXT],
          logColors
        )}
      </StyledPanelItem>
      <StyledPanelItem overflow>
        {bodyRenderer(dataRow[OurLogKnownFieldKey.BODY], highlightTerms)}
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <TimestampRenderer timestamp={dataRow.timestamp} />
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
  const level = getLogSeverityLevel(
    dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER],
    dataRow[OurLogKnownFieldKey.SEVERITY_TEXT]
  );
  const theme = useTheme();
  const logColors = getLogColors(level, theme);
  return (
    <DetailsWrapper span={3}>
      <DetailsGrid>
        <DetailsSubGrid>
          <DetailsLabel>Timestamp</DetailsLabel>
          <DetailsValue>
            <TimestampRenderer timestamp={dataRow.timestamp} />
          </DetailsValue>
        </DetailsSubGrid>
        <DetailsSubGrid>
          <DetailsLabel>Severity</DetailsLabel>
          <DetailsValue>
            {severityTextRenderer(
              dataRow[OurLogKnownFieldKey.SEVERITY_NUMBER],
              dataRow[OurLogKnownFieldKey.SEVERITY_TEXT],
              logColors,
              true
            )}
          </DetailsValue>
        </DetailsSubGrid>
      </DetailsGrid>
      <DetailsFooter logColors={logColors}>
        {bodyRenderer(dataRow['log.body'], highlightTerms, true)}
      </DetailsFooter>
    </DetailsWrapper>
  );
}
