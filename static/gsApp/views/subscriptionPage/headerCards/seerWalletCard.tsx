import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconInfo} from '@sentry/icons/info';
import {IconSeer} from '@sentry/icons/seer';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
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
    return <SeerWalletError />;
  }

  if (!balanceQuery.data || !autoTopUpQuery.data) {
    return <Placeholder height="100%" />;
  }

  const wallet = balanceQuery.data;
  const autoTopUp = autoTopUpQuery.data;
  const isPaused = wallet.balance <= 0;
  const totalCredits = wallet.included.total + wallet.purchased.total;
  const {creditPriceCents} = wallet;
  // The wallet only includes credit pricing for billing roles, and this card is only
  // rendered for them.
  if (creditPriceCents === undefined) {
    return <SeerWalletError />;
  }

  const openModal = () => openSeerAutoTopUpModal({organization});

  return (
    <SubscriptionHeaderCard
      sections={[
        <Flex key="title" justify="between" align="center" width="100%" gap="sm">
          <SeerTitle />
          <AutoTopUpStatus isPaused={isPaused} autoTopUpEnabled={autoTopUp.enabled} />
        </Flex>,
        <Stack key="balance" gap="sm">
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
              maxWidth={240}
              title={
                <CreditBreakdown
                  wallet={wallet}
                  autoTopUp={autoTopUp}
                  creditPriceCents={creditPriceCents}
                />
              }
            >
              <Flex align="center" aria-label={t('Credit breakdown')}>
                <IconInfo size="xs" variant="muted" />
              </Flex>
            </Tooltip>
          </Flex>
        </Stack>,
        autoTopUp.enabled ? (
          <Button key="action" size="xs" onClick={openModal}>
            {t('Edit')}
          </Button>
        ) : (
          <Button
            key="action"
            size="xs"
            variant={isPaused ? 'primary' : 'secondary'}
            onClick={openModal}
          >
            {t('Turn on auto-reload')}
          </Button>
        ),
      ]}
    />
  );
}

function SeerWalletError() {
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
    return <Tag variant="success">{t('Auto-reload on')}</Tag>;
  }
  return <Tag variant="muted">{t('Auto-reload off')}</Tag>;
}

function CreditBreakdown({
  wallet,
  autoTopUp,
  creditPriceCents,
}: {
  autoTopUp: SeerWalletAutoTopUp;
  creditPriceCents: number;
  wallet: SeerWalletBalance;
}) {
  const {included, purchased} = wallet;
  const showPurchased = purchased.total > 0 || autoTopUp.enabled;

  return (
    <Stack gap="md" width="216px" align="stretch">
      <Flex justify="between" gap="md">
        <Text size="sm" bold>
          {t('Included')}
        </Text>
        {included.resetsAt && (
          <Text size="sm" variant="muted">
            {tct('Resets [date]', {date: moment(included.resetsAt).format('MMM D')})}
          </Text>
        )}
      </Flex>
      <Stack gap="sm">
        <CreditMeter remaining={included.remaining} total={included.total} />
        <Flex justify="between" gap="md">
          <Text size="sm">
            {tct('[remaining] remaining', {
              remaining: Math.max(included.remaining, 0).toLocaleString(),
            })}
          </Text>
          <Text size="sm">{included.total.toLocaleString()}</Text>
        </Flex>
      </Stack>
      {showPurchased && (
        <Fragment>
          <Flex justify="between" gap="md" paddingTop="lg" borderTop="muted">
            <Text size="sm" bold>
              {t('Purchased')}
            </Text>
            {purchased.expiresAt && (
              <Text size="sm" variant="muted">
                {tct('Expires [date]', {
                  date: moment(purchased.expiresAt).format('MMM D, YYYY'),
                })}
              </Text>
            )}
          </Flex>
          <Text size="sm" align="left">
            {tct('[remaining] remaining', {
              remaining: purchased.remaining.toLocaleString(),
            })}
          </Text>
          {autoTopUp.enabled && (
            <Grid columns="1fr auto" gap="sm md" paddingLeft="md" borderLeft="primary">
              <Text size="sm" align="left">
                {t('If credits fall below')}
              </Text>
              <Text size="sm" align="right">
                {autoTopUp.thresholdCredits.toLocaleString()}
              </Text>
              <Text size="sm" align="left">
                {t('Reload amount')}
              </Text>
              <Text size="sm" align="right">
                {autoTopUp.topUpCredits.toLocaleString()}
              </Text>
              <Text size="sm" align="left">
                {t('Up to a maximum of')}
              </Text>
              <Text size="sm" align="right">
                {tct('[credits] / day', {
                  credits: Math.floor(
                    autoTopUp.dailySpendCapCents / creditPriceCents
                  ).toLocaleString(),
                })}
              </Text>
            </Grid>
          )}
        </Fragment>
      )}
    </Stack>
  );
}

function CreditMeter({remaining, total}: {remaining: number; total: number}) {
  const percent = total > 0 ? Math.min(Math.max(remaining / total, 0), 1) * 100 : 0;
  return (
    <MeterTrack
      role="meter"
      aria-valuenow={Math.max(remaining, 0)}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <MeterFill percent={percent} />
    </MeterTrack>
  );
}

const MeterTrack = styled('div')`
  height: 5px;
  border-radius: 100px;
  overflow: hidden;
  background: ${p => p.theme.tokens.graphics.neutral.muted};
`;

const MeterFill = styled('div')<{percent: number}>`
  height: 100%;
  width: ${p => p.percent}%;
  background: ${p => p.theme.tokens.graphics.success.vibrant};
`;
