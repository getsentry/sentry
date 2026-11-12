import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {displayPrice} from 'getsentry/utils/billing';
import {
  getSeerDailyLimitError,
  getSeerLoadAmountError,
  SEER_CREDIT_PRICE_CENTS,
  SEER_INCLUDED_CREDITS_CENTS,
  useSeerAutoLoad,
} from 'getsentry/views/amCheckout/seerCredits';
import type {CheckoutFormData, SeerAutoLoad} from 'getsentry/views/amCheckout/types';
import {DollarInput} from 'getsentry/views/subscriptionPage/seerWallet/dollarInput';

const FEATURES = [
  t('Find the root cause of issues'),
  t('Generate fixes and open pull requests'),
  t('Flag the most fixable issues as they come in'),
  t('Ask Seer questions about your app'),
];

interface SeerCreditsCardProps {
  formData: CheckoutFormData;
  onUpdate: (data: Partial<CheckoutFormData>) => void;
  organization: Organization;
}

/**
 * Seer for plans billed on credits: every plan includes credits each month,
 * and auto-load buys more when they run low.
 */
export function SeerCreditsCard({
  formData,
  onUpdate,
  organization,
}: SeerCreditsCardProps) {
  const {isPending, seerAutoLoad} = useSeerAutoLoad({formData, organization});

  const updateAutoLoad = (data: Partial<SeerAutoLoad>) => {
    if (seerAutoLoad) {
      onUpdate({seerAutoLoad: {...seerAutoLoad, ...data}});
    }
  };

  return (
    <Container
      border="primary"
      radius="md"
      background="primary"
      overflow="hidden"
      data-test-id="seer-credits"
    >
      <Flex justify="between" align="start" gap="lg" padding="lg xl">
        <Stack gap="xs">
          <Heading as="h3">{t('Seer')}</Heading>
          <Text variant="muted">
            {t('Detect and fix issues faster with our AI agent')}
          </Text>
        </Stack>
        <Stack gap="xs" align="end" flexShrink={0}>
          <Heading as="h3" variant="promotion">
            {tct('[amount] in credits', {
              amount: displayPrice({cents: SEER_INCLUDED_CREDITS_CENTS}),
            })}
          </Heading>
          <Text variant="muted">{t('Included every month')}</Text>
        </Stack>
      </Flex>
      <Stack gap="xl" padding="xl" borderTop="primary">
        <Grid columns={{zero: '1fr', sm: 'repeat(2, minmax(0, 1fr))'}} gap="md xl">
          {FEATURES.map(feature => (
            <Flex key={feature} align="start" gap="md">
              <Flex align="center" height="1lh">
                <IconCheckmark variant="success" />
              </Flex>
              <Text>{feature}</Text>
            </Flex>
          ))}
        </Grid>
        <Text variant="muted">
          {t(
            'All features use credits. Additional usage can be purchased with auto-load enabled.'
          )}
        </Text>
      </Stack>
      <Stack gap="lg" padding="xl" borderTop="primary">
        <Flex justify="between" align="start" gap="xl">
          <Stack gap="xs">
            <Text as="label" htmlFor="seer-auto-load" bold>
              {t('Auto-load')}
            </Text>
            <Text variant="muted">
              {t(
                'Add credits automatically when your balance runs low, so Seer keeps working.'
              )}
            </Text>
          </Stack>
          {isPending || !seerAutoLoad ? (
            <Placeholder width="40px" height="24px" />
          ) : (
            <Switch
              id="seer-auto-load"
              size="lg"
              checked={seerAutoLoad.enabled}
              onChange={() => updateAutoLoad({enabled: !seerAutoLoad.enabled})}
            />
          )}
        </Flex>
        {seerAutoLoad?.enabled && !isPending && (
          <Stack gap="lg">
            <Container border="primary" radius="md" background="secondary">
              <AutoLoadRow
                id="seer-auto-load-amount"
                label={t('Load amount')}
                error={getSeerLoadAmountError(seerAutoLoad)}
                cents={seerAutoLoad.loadAmountCents}
                onChange={loadAmountCents => updateAutoLoad({loadAmountCents})}
              />
              <Container borderTop="primary">
                <AutoLoadRow
                  id="seer-auto-load-daily-limit"
                  label={t('Daily usage limit')}
                  error={getSeerDailyLimitError(seerAutoLoad)}
                  cents={seerAutoLoad.dailyLimitCents}
                  onChange={dailyLimitCents => updateAutoLoad({dailyLimitCents})}
                />
              </Container>
            </Container>
            <Text size="sm">
              {t(
                "Note: Credits you buy can't be refunded and expire 12 months after your latest purchase."
              )}
            </Text>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function AutoLoadRow({
  id,
  label,
  error,
  cents,
  onChange,
}: {
  cents: number;
  error: ReactNode;
  id: string;
  label: string;
  onChange: (cents: number) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <Flex justify="between" align="start" gap="lg" padding="md lg">
      <Flex align="center" minHeight="36px">
        <Text as="label" htmlFor={id} bold={false}>
          {label}
        </Text>
      </Flex>
      <Stack gap="xs" align="end" width="13rem" flexShrink={0}>
        <DollarInput
          id={id}
          cents={cents}
          creditPriceCents={SEER_CREDIT_PRICE_CENTS}
          onChange={onChange}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <Text id={errorId} size="sm" variant="danger" align="right">
            {error}
          </Text>
        )}
      </Stack>
    </Flex>
  );
}
