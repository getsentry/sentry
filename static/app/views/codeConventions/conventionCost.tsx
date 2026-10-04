import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {
  conventionQueryOptions,
  getConventionScanUsage,
} from 'sentry/views/codeConventions/utils';

/**
 * Table cell with a convention's estimated LLM spend over the last 30 days.
 */
export function ConventionCost({filename}: {filename: string}) {
  const {data: convention, isPending} = useQuery(conventionQueryOptions(filename));

  if (isPending) {
    return <Placeholder width="60px" height="20px" />;
  }
  const usage = convention ? getConventionScanUsage(convention) : undefined;
  if (!usage) {
    return <Text variant="muted">{'\u2014'}</Text>;
  }
  return (
    <Stack gap="2xs">
      <Text>{`$${usage.costUsd.toFixed(2)}`}</Text>
      <Text size="xs" variant="muted">
        {t('%s tokens', formatAbbreviatedNumber(usage.tokens))}
      </Text>
    </Stack>
  );
}
