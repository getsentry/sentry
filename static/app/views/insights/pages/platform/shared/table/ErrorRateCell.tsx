import {useTheme} from '@emotion/react';
import type {LocationDescriptor} from 'history';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {defined} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {ThresholdCell} from 'sentry/views/insights/pages/platform/shared/table/ThresholdCell';

export function getErrorCellIssuesLink({
  projectId,
  query,
}: {
  projectId: number | string;
  query: string;
}) {
  return {
    pathname: '/issues/',
    query: {
      project: projectId,
      query: `is:unresolved event.type:error ${query}`,
    },
  };
}

export function ErrorRateCell({
  errorRate,
  issuesLink,
  total,
}: {
  errorRate: number;
  total: number;
  issuesLink?: LocationDescriptor;
}) {
  const theme = useTheme();
  const errorCount = Math.floor(errorRate * total);

  const errorCountElement =
    issuesLink && errorCount > 0 ? (
      <Link to={issuesLink}>({formatAbbreviatedNumber(errorCount)})</Link>
    ) : (
      <span style={{color: theme.tokens.content.secondary}}>
        ({formatAbbreviatedNumber(errorCount)})
      </span>
    );

  return (
    <ThresholdCell value={errorRate}>
      <Flex align="center" justify="end" gap="xs">
        {formatPercentage(errorRate, 2, {minimumValue: 0.0001})}
        {defined(errorCount) ? errorCountElement : null}
      </Flex>
    </ThresholdCell>
  );
}
