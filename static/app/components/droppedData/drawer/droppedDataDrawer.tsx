import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

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
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';

interface DroppedDataDrawerProps {
  dataset: DiscoverDatasets;
  interval?: string;
  onAskSeer?: (row: ReasonRow) => void;
}

export function DroppedDataDrawer({
  dataset,
  interval,
  onAskSeer,
}: DroppedDataDrawerProps) {
  const theme = useTheme();
  const [chartInterval] = useChartInterval();
  const {droppedEvents, acceptedEvents, isPending, isError, refetch} = useDroppedData({
    dataset,
    interval: interval ?? chartInterval,
  });

  const [scope, setScope] = useState<DroppedDataScope>('contributing');
  const [outcomeSelection, setOutcomeSelection] = useState<OutcomeSelection>({});

  const scopedDroppedEvents = filterDroppedEventsByScope(droppedEvents ?? [], scope);
  const groups = droppedEventsToOutcomeGroups(
    droppedEvents ?? [],
    acceptedEvents ?? [],
    scope
  );
  // Colored from every outcome so colors stay stable when the scope changes.
  const outcomeColors = getOutcomeColors(
    (droppedEvents ?? []).map(event => event.outcome),
    theme
  );
  const selectedUnintentional = groups.unintentional.filter(section =>
    isOutcomeSelected(outcomeSelection, section.outcome)
  );
  const selectedIntentional = groups.intentional.filter(section =>
    isOutcomeSelected(outcomeSelection, section.outcome)
  );

  return (
    <Fragment>
      <DrawerHeader>
        <Flex flex="1" align="center" justify="between" gap="md" paddingRight="lg">
          <Text size="md">{t('Dropped and Filtered Events')}</Text>
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
      <BandedDrawerBody>
        {isError ? (
          <Container padding="xl 2xl">
            <LoadingError
              message={t('There was an error loading dropped events.')}
              onRetry={() => void refetch()}
            />
          </Container>
        ) : isPending ? (
          <Container padding="xl 2xl">
            <LoadingIndicator />
          </Container>
        ) : (
          <Fragment>
            <Container background="primary" padding="xl 3xl lg">
              <DroppedDataChart
                droppedEvents={scopedDroppedEvents}
                colors={outcomeColors}
                selection={outcomeSelection}
                onSelectionChange={setOutcomeSelection}
              />
            </Container>
            <Stack flex="1" gap="2xl" background="secondary" padding="2xl xl">
              {selectedUnintentional.length > 0 && (
                <Stack gap="xl">
                  <Container padding="0 xl">
                    <Heading as="h3" size="xl">
                      {t('Unexpected Drops')}
                    </Heading>
                  </Container>
                  <DroppedDataOutcomeList
                    sections={selectedUnintentional}
                    onAskSeer={onAskSeer}
                  />
                </Stack>
              )}
              {selectedIntentional.length > 0 && (
                <Stack gap="xl">
                  <Stack gap="2xl">
                    <Separator orientation="horizontal" border="primary" />
                    <Container padding="0 xl">
                      <Heading as="h3" size="xl">
                        {t('Expected Drops')}
                      </Heading>
                    </Container>
                  </Stack>
                  <DroppedDataOutcomeList
                    sections={selectedIntentional}
                    onAskSeer={onAskSeer}
                  />
                </Stack>
              )}
            </Stack>
          </Fragment>
        )}
      </BandedDrawerBody>
    </Fragment>
  );
}

const BandedDrawerBody = styled(DrawerBody)`
  display: flex;
  flex-direction: column;
  min-height: calc(100% - ${PRIMARY_HEADER_HEIGHT}px);
  padding: 0;
`;
