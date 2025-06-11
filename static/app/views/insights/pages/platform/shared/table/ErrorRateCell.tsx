import {useTheme} from '@emotion/react';
import type {LocationDescriptor} from 'history';

import {Flex} from 'sentry/components/container/flex';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
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
      <Link to={issuesLink}>({errorCount})</Link>
    ) : (
      <span style={{color: theme.subText}}>({errorCount})</span>
    );

  return (
    <ThresholdCell value={errorRate}>
      <Flex align="center" justify="flex-end" gap={space(0.5)}>
        {(errorRate * 100).toFixed(2)}%{defined(errorCount) ? errorCountElement : null}
      </Flex>
    </ThresholdCell>
  );
}
