import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex} from '@sentry/scraps/layout/flex';

import {Text} from 'sentry/components/core/text';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {UptimeCheckAttributes} from './uptimeCheckAttributes';

type Props = {
  check: UptimeCheck;
  project: Project;
};

export function UptimeCheckDetails({check, project}: Props) {
  const organization = useOrganization();
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

  return (
    <Flex data-overlay="true" direction="column">
      <DrawerHeader hideBar />
      <StyledFlex
        height="60px"
        direction="row"
        align="center"
        justify="between"
        padding="lg 2xl"
      >
        <Text size="xl" bold>
          {t('Check-In')}
        </Text>
        {traceItemData && (
          <LinkButton
            size="xs"
            to={{
              pathname: `/organizations/${organization.slug}/performance/trace/${check.traceId}/`,
              query: {
                includeUptime: '1',
                timestamp: new Date(check.timestamp).getTime() / 1000,
                node: `uptime-check-${check.traceItemId}`,
              },
            }}
          >
            {t('View in Trace')}
          </LinkButton>
        )}
      </StyledFlex>
      <DrawerBody>
        {isTraceItemPending ? (
          <LoadingIndicator />
        ) : isTraceItemError ? (
          <LoadingError message={t('Failed to fetch trace item details')} />
        ) : traceItemData ? (
          <UptimeCheckAttributes attributes={traceItemData.attributes} />
        ) : (
          <NoDetailsAvailable size="xl" variant="muted" align="center">
            {t('No details available for Check-In')}
          </NoDetailsAvailable>
        )}
      </DrawerBody>
    </Flex>
  );
}

const StyledFlex = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const NoDetailsAvailable = styled(Text)`
  margin: ${p => p.theme.space['3xl']};
`;
