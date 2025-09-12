import moment from 'moment-timezone';

import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {IconDownload, IconGraph} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

import type {Subscription} from 'getsentry/types';

interface UsageOverviewProps {
  subscription: Subscription;
}

function UsageOverview({subscription}: UsageOverviewProps) {
  const currentPeriodStart = moment(subscription.onDemandPeriodStart);
  const currentPeriodEnd = moment(subscription.onDemandPeriodEnd);
  const daysTilCurrentPeriodEnd = currentPeriodEnd.diff(moment(), 'days') + 1;

  return (
    <Container border="primary" radius="md">
      <Flex justify="between" align="center" padding="2xl xl">
        <Container>
          <Heading as="h3" size="lg">
            {t('Usage Overview')}
          </Heading>
          <Text variant="muted" size="md">
            {tct(
              '[currentPeriodStart] - [currentPeriodEnd] ・ Reserved volume resets in [daysTilCurrentPeriodEnd] days left',
              {
                currentPeriodStart: currentPeriodStart.format('MMM D, YYYY'),
                currentPeriodEnd: currentPeriodEnd.format('MMM D, YYYY'),
                daysTilCurrentPeriodEnd,
              }
            )}
          </Text>
        </Container>
        <Flex gap="md">
          <Button icon={<IconDownload size="sm" />}>
            <Text size="sm">{t('Export CSV')}</Text>
          </Button>
          <Button icon={<IconGraph size="sm" />}>
            <Text size="sm">{t('View usage history')}</Text>
          </Button>
        </Flex>
      </Flex>
    </Container>
  );
}

export default UsageOverview;
