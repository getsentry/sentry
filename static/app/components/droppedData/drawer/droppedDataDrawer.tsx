import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {DroppedDataChart} from 'sentry/components/droppedData/drawer/droppedDataChart';
import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {
  droppedEventsToOutcomeGroups,
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

  const groups = useMemo(
    () => droppedEventsToOutcomeGroups(droppedEvents ?? [], acceptedEvents ?? []),
    [droppedEvents, acceptedEvents]
  );
  const outcomeColors = useMemo(
    () =>
      getOutcomeColors(
        [...groups.unintentional, ...groups.intentional].map(section => section.outcome),
        theme
      ),
    [groups, theme]
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
        <Text size="md" variant="muted">
          {t('Dropped Data')}
        </Text>
      </DrawerHeader>
      <DrawerBody>
        {isError ? (
          <LoadingError
            message={t('There was an error loading dropped data.')}
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <LoadingIndicator />
        ) : (
          <Stack gap="xl">
            <DroppedDataChart
              droppedEvents={droppedEvents ?? []}
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
                <Stack gap="xl" padding="0 xl">
                  <Separator orientation="horizontal" border="primary" />
                  <Heading as="h3" size="xl">
                    {t('Configured Drops')}
                  </Heading>
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
