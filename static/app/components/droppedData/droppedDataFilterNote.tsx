import {IconStack} from '@sentry/icons/stack';

import {Flex, useResponsivePropValue, type Responsive} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';

import {datasetNoun} from './outcomes';

export interface DroppedDataFilterNoteProps {
  dataset: DiscoverDatasets;
  hasUserQuery: boolean;
  environments?: string[];
  showIcon?: Responsive<boolean>;
}

/**
 * Dropped data only respects the project and date filters, so call out the
 * search and environment filters it ignores.
 */
export function DroppedDataFilterNote({
  dataset,
  hasUserQuery,
  environments,
  showIcon = true,
}: DroppedDataFilterNoteProps) {
  const {selection} = usePageFilters();
  const hasEnvironment = (environments ?? selection.environments).length > 0;
  const isIconVisible = useResponsivePropValue(showIcon);

  if (!hasUserQuery && !hasEnvironment) {
    return null;
  }

  const telemetry = datasetNoun(dataset, 2);
  const message =
    hasUserQuery && hasEnvironment
      ? t('Dropped %s ignore filters and environment', telemetry)
      : hasUserQuery
        ? t('Dropped %s ignore filters', telemetry)
        : t('Dropped %s ignore the environment', telemetry);

  return (
    <Flex align="center" gap="xs">
      {isIconVisible ? (
        <Flex flexShrink={0}>
          <IconStack size="xs" variant="muted" />
        </Flex>
      ) : null}
      <Text size="sm" variant="muted">
        {message}
      </Text>
    </Flex>
  );
}
