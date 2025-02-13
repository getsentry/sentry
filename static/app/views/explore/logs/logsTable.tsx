import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';

import EmptyStateWarning, {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {LOGS_PROPS_DOCS_URL} from 'sentry/constants';
import {IconWarning} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t, tct} from 'sentry/locale';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  bodyRenderer,
  severityCircleRenderer,
  severityTextRenderer,
  TimestampRenderer,
} from 'sentry/views/explore/logs/fieldRenderers';
import {useOurlogs} from 'sentry/views/insights/common/queries/useDiscover';
import type {OurlogsFields} from 'sentry/views/insights/types';
import {EmptyStateText} from 'sentry/views/traces/styles';

import {
  DetailsFooter,
  DetailsGrid,
  DetailsLabel,
  DetailsSubGrid,
  DetailsValue,
  DetailsWrapper,
  getLogColors,
  LogPanelContent,
  StyledChevronButton,
  StyledPanel,
  StyledPanelHeader,
  StyledPanelItem,
} from './styles';
import {getLogBodySearchTerms, getLogSeverityLevel} from './utils';

export type LogsTableProps = {
  search: MutableSearch;
};

type LogsRowProps = {
  dataRow: OurlogsFields;
  highlightTerms: string[];
};

const LOG_FIELDS: Array<keyof OurlogsFields> = [
  'log.severity_text',
  'log.severity_number',
  'log.body',
  'timestamp',
];

export function LogsTable(props: LogsTableProps) {
  const {data, isError, isPending} = useOurlogs(
    {
      limit: 100,
      sorts: [],
      fields: LOG_FIELDS,
      search: props.search,
    },
    'api.logs-tab.view'
  );

  const isEmpty = !isPending && !isError && (data?.length ?? 0) === 0;
  const highlightTerms = getLogBodySearchTerms(props.search);

  return (
    <StyledPanel>
      <LogPanelContent>
        <StyledPanelHeader align="left" lightText>
          {t('Severity')}
        </StyledPanelHeader>
        <StyledPanelHeader align="left" lightText>
          {t('Message')}
        </StyledPanelHeader>
        <StyledPanelHeader align="right" lightText>
          {t('Timestamp')}
        </StyledPanelHeader>
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
    dataRow['log.severity_number'],
    dataRow['log.severity_text']
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
          dataRow['log.severity_number'],
          dataRow['log.severity_text'],
          logColors
        )}
        {severityTextRenderer(
          dataRow['log.severity_number'],
          dataRow['log.severity_text'],
          logColors
        )}
      </StyledPanelItem>
      <StyledPanelItem overflow>
        {bodyRenderer(dataRow['log.body'], highlightTerms)}
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
  dataRow: OurlogsFields;
  highlightTerms: string[];
}) {
  const level = getLogSeverityLevel(
    dataRow['log.severity_number'],
    dataRow['log.severity_text']
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
              dataRow['log.severity_number'],
              dataRow['log.severity_text'],
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
