import {Flex} from '@sentry/scraps/layout/flex';

import {Text} from 'sentry/components/core/text';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {UptimeCheckAttributes} from './uptimeCheckAttributes';

type Props = {
  check: UptimeCheck;
  project: Project;
};

export function UptimeCheckDetails({check, project}: Props) {
  const {
    data: traceItemData,
    isPending: isTraceItemPending,
    isError: isTraceItemError,
  } = useTraceItemDetails({
    traceItemId: check.traceItemId,
    projectId: project.id.toString(),
    traceId: check.traceId,
    traceItemType: TraceItemDataset.UPTIME_RESULTS,
    referrer: 'uptime-check-details',
    enabled: true,
  });

  if (isTraceItemPending) {
    return <LoadingIndicator />;
  }

  if (isTraceItemError) {
    return <LoadingError message={t('Failed to fetch trace item details')} />;
  }

  return (
    <Flex direction="column" gap="md">
      <DrawerHeader hideBar />
      <DrawerBody>
        <Flex direction="column" gap="md" align="stretch" width="100%">
          <Text size="xl" bold>
            {t('Check-In')}
          </Text>
          <UptimeCheckAttributes attributes={traceItemData.attributes} />
        </Flex>
      </DrawerBody>
    </Flex>
  );
}
