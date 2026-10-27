import {IconStack} from '@sentry/icons/stack';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {datasetNoun} from 'sentry/components/droppedData/outcomes';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';

interface DroppedDataFilterNoteProps {
  dataset: DiscoverDatasets;
  hasUserQuery: boolean;
}

/**
 * Dropped data only respects the project and date filters, so call out the
 * search and environment filters it ignores.
 */
export function DroppedDataFilterNote({
  dataset,
  hasUserQuery,
}: DroppedDataFilterNoteProps) {
  const {selection} = usePageFilters();
  const hasEnvironment = selection.environments.length > 0;

  if (!hasUserQuery && !hasEnvironment) {
    return null;
  }

  const telemetry = datasetNoun(dataset, 2);
  const message =
    hasUserQuery && hasEnvironment
      ? t('Dropped %s are not filtered by search or environment', telemetry)
      : hasUserQuery
        ? t('Dropped %s are not filtered by search', telemetry)
        : t('Dropped %s are not filtered by environment', telemetry);

  return (
    <Flex align="center" gap="xs">
      <IconStack size="xs" variant="muted" />
      <Text size="sm" variant="muted">
        {message}
      </Text>
    </Flex>
  );
}
