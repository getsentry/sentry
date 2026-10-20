import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {DroppedDataChart} from 'sentry/components/droppedData/drawer/droppedDataChart';
import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {
  droppedEventsToOutcomeGroups,
  filterDroppedEventsByScope,
  type DroppedDataScope,
  type ReasonRow,
} from 'sentry/components/droppedData/drawer/outcomeSections';
import {
  getOutcomeColors,
  isOutcomeSelected,
  type OutcomeSelection,
} from 'sentry/components/droppedData/outcomes';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';

interface DroppedDataDrawerProps {
  dataset: DiscoverDatasets;
  interval?: string;
  onTroubleshoot?: (row: ReasonRow) => void;
}

export function DroppedDataDrawer({
  dataset,
  interval,
  onTroubleshoot,
}: DroppedDataDrawerProps) {
  const theme = useTheme();
  const [chartInterval] = useChartInterval();
  const {droppedEvents, acceptedEvents, isPending, isError, refetch} = useDroppedData({
    dataset,
    interval: interval ?? chartInterval,
  });

  const [scope, setScope] = useState<DroppedDataScope>('contributing');
  const scopedDroppedEvents = useMemo(
    () => filterDroppedEventsByScope(droppedEvents ?? [], scope),
    [droppedEvents, scope]
  );
  const groups = useMemo(
    () => droppedEventsToOutcomeGroups(droppedEvents ?? [], acceptedEvents ?? [], scope),
    [droppedEvents, acceptedEvents, scope]
  );
  // Colored from every outcome so colors stay stable when the scope changes.
  const outcomeColors = useMemo(
    () =>
      getOutcomeColors(
        (droppedEvents ?? []).map(event => event.outcome),
        theme
      ),
    [droppedEvents, theme]
  );

  const [outcomeSelection, setOutcomeSelection] = useState<OutcomeSelection>({});
  const selectedGroups = useMemo(
    () => ({
      unintentional: groups.unintentional.filter(section =>
        isOutcomeSelected(outcomeSelection, section.outcome)
      ),
      intentional: groups.intentional.filter(section =>
        isOutcomeSelected(outcomeSelection, section.outcome)
      ),
    }),
    [groups, outcomeSelection]
  );

  return (
    <Fragment>
      <DrawerHeader>
        <Flex flex="1" align="center" justify="between" gap="md" paddingRight="lg">
          <Text size="md" variant="muted">
            {t('Dropped Events')}
          </Text>
          <SegmentedControl
            aria-label={t('Filter dropped events')}
            size="xs"
            value={scope}
            onChange={setScope}
          >
            <SegmentedControl.Item key="contributing">
              {t('Unexpected')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="all">{t('All')}</SegmentedControl.Item>
          </SegmentedControl>
        </Flex>
      </DrawerHeader>
      <DrawerBody>
        {isError ? (
          <LoadingError
            message={t('There was an error loading dropped events.')}
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <LoadingIndicator />
        ) : (
          <Stack gap="xl">
            <DroppedDataChart
              droppedEvents={scopedDroppedEvents}
              colors={outcomeColors}
              selection={outcomeSelection}
              onSelectionChange={setOutcomeSelection}
            />
            {selectedGroups.unintentional.length > 0 && (
              <DroppedDataOutcomeList
                sections={selectedGroups.unintentional}
                colors={outcomeColors}
                onTroubleshoot={onTroubleshoot}
              />
            )}
            {selectedGroups.intentional.length > 0 && (
              <Stack gap="md">
                <Stack gap="xl">
                  <Separator orientation="horizontal" border="primary" />
                  <Container padding="0 xl">
                    <Heading as="h3" size="xl">
                      {t('Configured Drops')}
                    </Heading>
                  </Container>
                </Stack>
                <DroppedDataOutcomeList
                  sections={selectedGroups.intentional}
                  colors={outcomeColors}
                  onTroubleshoot={onTroubleshoot}
                />
              </Stack>
            )}
          </Stack>
        )}
      </DrawerBody>
    </Fragment>
  );
}
