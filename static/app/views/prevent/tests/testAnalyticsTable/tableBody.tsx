import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {space} from 'sentry/styles/space';
import {
  RIGHT_ALIGNED_FIELDS,
  type Column,
  type Row,
} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

interface TableBodyProps {
  column: Column;
  row: Row;
  wrapToggleValue: boolean;
}

export function renderTableBody({column, row, wrapToggleValue}: TableBodyProps) {
  const key = column.key;
  const value = row[key];
  const alignment = RIGHT_ALIGNED_FIELDS.has(key) ? 'right' : 'left';

  if (key === 'testName') {
    return (
      <TestNameContainer wrapToggleValue={wrapToggleValue}>{value}</TestNameContainer>
    );
  }

  if (key === 'averageDurationMs') {
    return (
      <NumberContainer>
        <PerformanceDuration milliseconds={Number(value)} abbreviation />
      </NumberContainer>
    );
  }

  if (key === 'flakeRate') {
    const isBrokenTest = row.isBrokenTest;

    return (
      <Tooltip
        showUnderline
        isHoverable
        maxWidth={300}
        title={
          <Fragment>
            {row.totalPassCount} Passed, {row.totalFailCount} Failed, (
            {row.totalFlakyFailCount} Flaky), {row.totalSkipCount} Skipped
          </Fragment>
        }
      >
        <NumberContainer>
          {isBrokenTest && <StyledTag type={'highlight'}>Broken test</StyledTag>}
          {Number(value).toFixed(2)}%
        </NumberContainer>
      </Tooltip>
    );
  }

  if (key === 'totalFailCount') {
    const totalFailCount = row.totalFailCount + row.totalFlakyFailCount;
    return <Container alignment={alignment}>{totalFailCount}</Container>;
  }

  if (key === 'lastRun') {
    return (
      <DateContainer>
        <DateTime date={value} year seconds timeZone />
      </DateContainer>
    );
  }

  return <Container alignment={alignment}>{value}</Container>;
}

const TestNameContainer = styled('div')<{wrapToggleValue: boolean}>`
  ${p => !p.wrapToggleValue && p.theme.overflowEllipsis};
  overflow-wrap: break-word;
  font-family: ${p => p.theme.text.familyMono};
  text-align: left;
`;

const Container = styled('div')<{alignment: string}>`
  ${p => p.theme.overflowEllipsis};
  font-family: ${p => p.theme.text.familyMono};
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
`;

const DateContainer = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
  text-align: 'left';
`;

const NumberContainer = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
  ${p => p.theme.overflowEllipsis};
`;

const StyledTag = styled(Tag)`
  margin-right: ${space(1.5)};
`;
