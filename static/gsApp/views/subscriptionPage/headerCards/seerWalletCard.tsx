import styled from '@emotion/styled';
import {IconInfo} from '@sentry/icons/info';
import {IconSeer} from '@sentry/icons/seer';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {SubscriptionHeaderCard} from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';
import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import {
  seerWalletAutoTopUpOptions,
  seerWalletBalanceOptions,
  type SeerWalletAutoTopUp,
  type SeerWalletBalance,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

export function SeerWalletCard({organization}: {organization: Organization}) {
  const balanceQuery = useQuery(seerWalletBalanceOptions(organization));
  const autoTopUpQuery = useQuery(seerWalletAutoTopUpOptions(organization));

  if (balanceQuery.isError || autoTopUpQuery.isError) {
    return (
      <SubscriptionHeaderCard
        sections={[
          <SeerTitle key="title" />,
          <Text key="error" variant="muted">
            {t('Unable to load your Seer credits.')}
          </Text>,
        ]}
      />
    );
  }

  if (!balanceQuery.data || !autoTopUpQuery.data) {
    return <Placeholder height="100%" />;
  }

  const wallet = balanceQuery.data;
  const autoTopUp = autoTopUpQuery.data;
  const isPaused = wallet.balance <= 0;
  const totalCredits = wallet.included.total + wallet.purchased.total;

  const openModal = () =>
    openSeerAutoTopUpModal({
      organization,
      autoTopUp,
      creditPriceCents: wallet.creditPriceCents,
    });

  return (
    <SubscriptionHeaderCard
      sections={[
        <Flex key="title" justify="between" align="center" width="100%" gap="sm">
          <SeerTitle />
          <AutoTopUpStatus isPaused={isPaused} autoTopUpEnabled={autoTopUp.enabled} />
        </Flex>,
        <Stack key="balance" gap="xs">
          <Text size="xl" bold>
            {wallet.balance.toLocaleString()}
          </Text>
          <Flex align="center" gap="xs">
            <Text variant="muted">
              {tct('of [totalCredits] credits available', {
                totalCredits: totalCredits.toLocaleString(),
              })}
            </Text>
            <Tooltip
              maxWidth={320}
              title={<CreditBreakdown wallet={wallet} autoTopUp={autoTopUp} />}
            >
              <Flex align="center" aria-label={t('Credit breakdown')}>
                <IconInfo size="xs" variant="muted" />
              </Flex>
            </Tooltip>
          </Flex>
        </Stack>,
        autoTopUp.enabled ? (
          <Button key="action" size="sm" onClick={openModal}>
            {t('Edit')}
          </Button>
        ) : (
          <Button
            key="action"
            size="sm"
            variant={isPaused ? 'primary' : 'secondary'}
            onClick={openModal}
          >
            {t('Turn on auto top-up')}
          </Button>
        ),
      ]}
    />
  );
}

function SeerTitle() {
  return (
    <Flex align="center" gap="sm">
      <IconSeer />
      <Heading as="h2" size="lg">
        {t('Seer')}
      </Heading>
    </Flex>
  );
}

function AutoTopUpStatus({
  isPaused,
  autoTopUpEnabled,
}: {
  autoTopUpEnabled: boolean;
  isPaused: boolean;
}) {
  if (isPaused) {
    return <Tag variant="warning">{t('Paused')}</Tag>;
  }
  if (autoTopUpEnabled) {
    return <Tag variant="success">{t('Auto top-up on')}</Tag>;
  }
  return <Tag variant="muted">{t('Auto top-up off')}</Tag>;
}

function CreditBreakdown({
  wallet,
  autoTopUp,
}: {
  autoTopUp: SeerWalletAutoTopUp;
  wallet: SeerWalletBalance;
}) {
  const {included, purchased} = wallet;
  const showPurchased = purchased.total > 0 || autoTopUp.enabled;

  return (
    <Stack gap="md" width="280px" align="stretch">
      <Stack gap="sm">
        <Flex justify="between" gap="md">
          <Text bold>{t('Included')}</Text>
          {included.resetsAt && (
            <Text variant="muted">
              {tct('Resets [date]', {date: moment(included.resetsAt).format('MMM D')})}
            </Text>
          )}
        </Flex>
        <CreditMeter
          remaining={included.remaining}
          total={included.total}
          variant="included"
        />
        <Flex justify="between" gap="md">
          <Text>
            {tct('[remaining] remaining', {
              remaining: Math.max(included.remaining, 0).toLocaleString(),
            })}
          </Text>
          <Text>{included.total.toLocaleString()}</Text>
        </Flex>
      </Stack>
      {showPurchased && (
        <Stack gap="sm">
          <Separator orientation="horizontal" border="primary" />
          <Flex justify="between" gap="md">
            <Text bold>{t('Purchased')}</Text>
            {purchased.expiresAt && (
              <Text variant="muted">
                {tct('Expires [date]', {
                  date: moment(purchased.expiresAt).format('MMM D, YYYY'),
                })}
              </Text>
            )}
          </Flex>
          <CreditMeter
            remaining={purchased.remaining}
            total={purchased.total}
            variant="purchased"
          />
          <Flex justify="between" gap="md">
            <Text>
              {tct('[remaining] remaining', {
                remaining: purchased.remaining.toLocaleString(),
              })}
            </Text>
            <Text>{purchased.total.toLocaleString()}</Text>
          </Flex>
          {autoTopUp.enabled && (
            <Grid columns="1fr auto" gap="xs md" paddingLeft="md" borderLeft="primary">
              <Text align="left">{t('If credits fall below')}</Text>
              <Text align="right">{autoTopUp.thresholdCredits.toLocaleString()}</Text>
              <Text align="left">{t('Top up by')}</Text>
              <Text align="right">{autoTopUp.topUpCredits.toLocaleString()}</Text>
              <Text align="left">{t('Up to a maximum of')}</Text>
              <Text align="right">
                {tct('[credits] / day', {
                  credits: Math.floor(
                    autoTopUp.dailySpendCapCents / wallet.creditPriceCents
                  ).toLocaleString(),
                })}
              </Text>
            </Grid>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function CreditMeter({
  remaining,
  total,
  variant,
}: {
  remaining: number;
  total: number;
  variant: 'included' | 'purchased';
}) {
  const percent = total > 0 ? Math.min(Math.max(remaining / total, 0), 1) * 100 : 0;
  return (
    <MeterTrack
      role="meter"
      aria-valuenow={Math.max(remaining, 0)}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <MeterFill percent={percent} variant={variant} />
    </MeterTrack>
  );
}

const MeterTrack = styled('div')`
  height: 6px;
  border-radius: 100px;
  overflow: hidden;
  background: ${p => p.theme.tokens.graphics.neutral.muted};
`;

const MeterFill = styled('div')<{percent: number; variant: 'included' | 'purchased'}>`
  height: 100%;
  width: ${p => p.percent}%;
  background: ${p =>
    p.variant === 'included'
      ? p.theme.tokens.graphics.success.vibrant
      : p.theme.tokens.graphics.accent.vibrant};
`;
