import {IconStack} from '@sentry/icons/stack';

import {Flex, useResponsivePropValue, type Responsive} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {datasetNoun} from 'sentry/components/droppedData/outcomes';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';

interface DroppedDataFilterNoteProps {
  dataset: DiscoverDatasets;
  hasUserQuery: boolean;
  showIcon?: Responsive<boolean>;
}

/**
 * Dropped data only respects the project and date filters, so call out the
 * search and environment filters it ignores.
 */
export function DroppedDataFilterNote({
  dataset,
  hasUserQuery,
  showIcon = true,
}: DroppedDataFilterNoteProps) {
  const {selection} = usePageFilters();
  const hasEnvironment = selection.environments.length > 0;
  const isIconVisible = useResponsivePropValue(showIcon);

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
    <Flex align="start" gap="xs">
      {isIconVisible ? (
        <Flex flexShrink={0} paddingTop="2xs">
          <IconStack size="xs" variant="muted" />
        </Flex>
      ) : null}
      <Text size="sm" variant="muted">
        {message}
      </Text>
    </Flex>
  );
}
