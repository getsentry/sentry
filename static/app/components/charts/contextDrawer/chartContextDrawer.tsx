import {Fragment, useState} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {DroppedDataPanel} from 'sentry/components/droppedData/drawer/droppedDataPanel';
import {droppedAndFilteredLabel} from 'sentry/components/droppedData/outcomes';
import type {
  AskSeerHandler,
  DroppedDataScope,
} from 'sentry/components/droppedData/outcomeSections';
import type {UseDroppedDataParams} from 'sentry/components/droppedData/useDroppedData';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';

interface ChartContextDrawerProps extends UseDroppedDataParams {
  source: DroppedDataAnalyticsSource;
  onAskSeer?: AskSeerHandler;
}

export function ChartContextDrawer({
  dataset,
  interval,
  projects,
  source,
  onAskSeer,
}: ChartContextDrawerProps) {
  const organization = useOrganization();
  const [scope, setScope] = useState<DroppedDataScope>('unexpected');

  return (
    <Fragment>
      <DrawerHeader>
        <Flex flex="1" align="center" justify="between" gap="md" paddingRight="lg">
          <Text size="md">{droppedAndFilteredLabel(dataset)}</Text>
          <SegmentedControl
            aria-label={t('Filter dropped events')}
            size="xs"
            value={scope}
            onChange={nextScope => {
              setScope(nextScope);
              trackAnalytics('explore.dropped_data.scope_toggled', {
                organization,
                dataset,
                source,
                scope: nextScope,
              });
            }}
          >
            <SegmentedControl.Item key="unexpected">
              {t('Unexpected')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="all">{t('All')}</SegmentedControl.Item>
          </SegmentedControl>
        </Flex>
      </DrawerHeader>
      <Stack minHeight={`calc(100% - ${PRIMARY_HEADER_HEIGHT}px)`} padding="0">
        {props => (
          <DrawerBody {...props}>
            <DroppedDataPanel
              dataset={dataset}
              interval={interval}
              projects={projects}
              scope={scope}
              source={source}
              onAskSeer={onAskSeer}
              onScopeChange={setScope}
            />
          </DrawerBody>
        )}
      </Stack>
    </Fragment>
  );
}
