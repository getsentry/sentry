import {IconInfo} from '@sentry/icons/info';
import {IconPause} from '@sentry/icons/pause';
import {IconSeer} from '@sentry/icons/seer';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
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
  // Once purchased credits are gone and nothing will buy more, the balance is
  // just the month's included credits, so the card counts against those.
  const hasPurchasedCredits = wallet.purchased.remaining > 0 || autoTopUp.enabled;

  const openModal = () => openSeerAutoTopUpModal({organization});

  return (
    <SubscriptionHeaderCard
      sections={[
        <Flex key="title" justify="between" align="center" width="100%" gap="xs">
          <SeerTitle />
          {isPaused && <PausedTag wallet={wallet} autoTopUp={autoTopUp} />}
        </Flex>,
        <Stack key="balance" gap="xs">
          <Text size="xl" density="compressed" bold>
            {Math.max(wallet.balance, 0).toLocaleString()}
          </Text>
          {hasPurchasedCredits ? (
            <Flex align="center" gap="xs">
              <Text size="sm" variant="muted">
                {t('credits remaining')}
              </Text>
              <Tooltip maxWidth={240} title={<CreditBreakdown wallet={wallet} />}>
                <Flex align="center" aria-label={t('Credit breakdown')}>
                  <IconInfo size="xs" variant="muted" />
                </Flex>
              </Tooltip>
            </Flex>
          ) : (
            <Text size="sm" variant="muted">
              {wallet.included.resetsAt
                ? tct('of [total] credits remaining • Resets [date]', {
                    total: wallet.included.total.toLocaleString(),
                    date: moment(wallet.included.resetsAt).format('MMM D'),
                  })
                : tct('of [total] credits remaining', {
                    total: wallet.included.total.toLocaleString(),
                  })}
            </Text>
          )}
        </Stack>,
        <Flex
          key="auto-load"
          justify="between"
          align="center"
          gap="lg"
          width="100%"
          paddingTop="lg"
          borderTop="secondary"
        >
          <Stack gap="2xs">
            <Text size="xs" bold>
              {autoTopUp.enabled ? t('Auto-reload • On') : t('Auto-reload • Off')}
            </Text>
            <Text size="xs" variant="muted">
              {autoTopUp.enabled
                ? tct('Adds [credits] credits when below [threshold]', {
                    credits: autoTopUp.topUpCredits.toLocaleString(),
                    threshold: autoTopUp.thresholdCredits.toLocaleString(),
                  })
                : t('Buy more credits when you run low')}
            </Text>
          </Stack>
          {autoTopUp.enabled ? (
            <Button size="xs" onClick={openModal}>
              {t('Manage')}
            </Button>
          ) : (
            <Button
              size="xs"
              variant={isPaused ? 'primary' : 'secondary'}
              onClick={openModal}
            >
              {t('Set up')}
            </Button>
          )}
        </Flex>,
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
      <IconSeer size="sm" />
      <Heading as="h2" size="md">
        {t('Seer')}
      </Heading>
    </Flex>
  );
}

function PausedTag({
  wallet,
  autoTopUp,
}: {
  autoTopUp: SeerWalletAutoTopUp;
  wallet: SeerWalletBalance;
}) {
  // With auto-reload on, an empty wallet means the daily usage limit stopped the
  // auto-reloads, so Seer resumes the next day rather than when included credits reset.
  const resumesAt = autoTopUp.enabled ? null : wallet.included.resetsAt;

  return (
    <Tag variant="danger" icon={<IconPause />}>
      {resumesAt
        ? tct('Paused until [date]', {date: moment(resumesAt).format('MMM D')})
        : t('Paused')}
    </Tag>
  );
}

function CreditBreakdown({wallet}: {wallet: SeerWalletBalance}) {
  const {included, purchased} = wallet;

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text size="sm" align="left" bold>
          {tct('[remaining] included credits remaining', {
            remaining: Math.max(included.remaining, 0).toLocaleString(),
          })}
        </Text>
        {included.resetsAt && (
          <Text size="sm" align="left" variant="muted">
            {tct('Resets to [total] on [date]', {
              total: included.total.toLocaleString(),
              date: moment(included.resetsAt).format('MMM D'),
            })}
          </Text>
        )}
      </Stack>
      <Stack gap="xs">
        <Text size="sm" align="left" bold>
          {tct('[remaining] purchased credits remaining', {
            remaining: Math.max(purchased.remaining, 0).toLocaleString(),
          })}
        </Text>
        {purchased.expiresAt && (
          <Text size="sm" align="left" variant="muted">
            {tct('Expires on [date]', {
              date: moment(purchased.expiresAt).format('MMM D, YYYY'),
            })}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
