import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {openModal, type ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {seerCreditChecksQueryKey} from 'sentry/utils/seer/useSeerCreditCheck';

import {displayPrice, displayPriceWithCents} from 'getsentry/utils/billing';
import {
  seerWalletAutoTopUpOptions,
  seerWalletBalanceOptions,
  type SeerWalletAutoTopUp,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

const RELOAD_PRESETS_CENTS = [1000, 2500, 5000, 15000];

interface AutoTopUpModalOptions {
  organization: Organization;
}

type AutoTopUpModalProps = AutoTopUpModalOptions & ModalRenderProps;

type AutoTopUpFormProps = AutoTopUpModalProps & {
  autoTopUp: SeerWalletAutoTopUp;
  balanceCredits: number;
  creditPriceCents: number;
  purchasedExpiresAt: string | null;
};

function parseWholeNumber(value: string) {
  return Math.max(0, parseInt(value.replace(/\D/g, ''), 10) || 0);
}

function toWholeDollarCents(cents: number) {
  return Math.floor(cents / 100) * 100;
}

/**
 * Seer auto-reload settings. The modal loads the wallet itself so it can be
 * opened from anywhere; on the billing page the wallet card has already loaded
 * it, so it shows straight from the cache.
 */
function AutoTopUpModal(props: AutoTopUpModalProps) {
  const {Header, Body, organization} = props;
  const balanceQuery = useQuery(seerWalletBalanceOptions(organization));
  const autoTopUpQuery = useQuery(seerWalletAutoTopUpOptions(organization));

  // The wallet only includes credit pricing for billing roles, the only ones
  // offered auto-reload.
  const creditPriceCents = balanceQuery.data?.creditPriceCents;

  if (balanceQuery.data && autoTopUpQuery.data && creditPriceCents !== undefined) {
    return (
      <AutoTopUpForm
        {...props}
        autoTopUp={autoTopUpQuery.data}
        balanceCredits={balanceQuery.data.balance}
        creditPriceCents={creditPriceCents}
        purchasedExpiresAt={balanceQuery.data.purchased.expiresAt}
      />
    );
  }

  const isError =
    balanceQuery.isError ||
    autoTopUpQuery.isError ||
    (balanceQuery.data && creditPriceCents === undefined);

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h2" size="xl">
          {t('Seer auto-reload')}
        </Heading>
      </Header>
      <Body>
        {isError ? (
          <LoadingError
            message={t('Unable to load your Seer credits.')}
            onRetry={() => {
              balanceQuery.refetch();
              autoTopUpQuery.refetch();
            }}
          />
        ) : (
          <LoadingIndicator />
        )}
      </Body>
    </Fragment>
  );
}

function AutoTopUpForm({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  autoTopUp,
  balanceCredits,
  creditPriceCents,
  purchasedExpiresAt,
}: AutoTopUpFormProps) {
  const queryClient = useQueryClient();
  const isTurningOn = !autoTopUp.enabled;
  // The backend bills a reload once the balance is at or below the threshold.
  const isChargedNow = isTurningOn && balanceCredits <= autoTopUp.thresholdCredits;
  const [isConfirmingTurnOff, setIsConfirmingTurnOff] = useState(false);
  const [reloadCents, setReloadCents] = useState(
    toWholeDollarCents(autoTopUp.topUpCredits * creditPriceCents)
  );
  const [dailyLimitCents, setDailyLimitCents] = useState(
    toWholeDollarCents(autoTopUp.dailySpendCapCents)
  );
  const [error, setError] = useState<string | null>(null);

  const {mutate: save, isPending} = useMutation({
    mutationFn: (data: SeerWalletAutoTopUp) =>
      fetchMutation<SeerWalletAutoTopUp>({
        url: getApiUrl('/customers/$organizationIdOrSlug/seer-wallet/auto-top-up/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'PUT',
        data,
      }),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: seerWalletAutoTopUpOptions(organization).queryKey,
      });
      // Turning on can bill a reload right away, so refresh the balance as well.
      queryClient.invalidateQueries({
        queryKey: seerWalletBalanceOptions(organization).queryKey,
      });
      // Turning on auto-reload can unblock Seer, so let gated buttons recheck.
      queryClient.invalidateQueries({queryKey: seerCreditChecksQueryKey(organization)});
      if (!data.enabled) {
        toast.success(t('Auto-reload turned off'));
      } else if (isTurningOn) {
        toast.success(t('Auto-reload turned on'));
      } else {
        toast.success(t('Auto-reload settings saved'));
      }
      closeModal();
    },
    onError: err => {
      const fieldErrors =
        err instanceof RequestError
          ? (err.responseJSON as Record<string, string[]> | undefined)
          : undefined;
      setIsConfirmingTurnOff(false);
      setError(
        fieldErrors
          ? Object.values(fieldErrors).flat().join(' ')
          : t('Unable to save your auto-reload settings.')
      );
    },
  });

  if (isConfirmingTurnOff) {
    return (
      <Fragment>
        <Header closeButton>
          <Heading as="h2" size="xl">
            {t('Turn off auto-reload?')}
          </Heading>
        </Header>
        <Body>
          <Text as="p" size="lg">
            {purchasedExpiresAt
              ? tct(
                  'Your balance will remain, and expires on [date]. When it runs out, Seer pauses until your included credits reset.',
                  {date: moment(purchasedExpiresAt).format('MMM D, YYYY')}
                )
              : t(
                  'Your balance will remain. When it runs out, Seer pauses until your included credits reset.'
                )}
          </Text>
        </Body>
        <Footer>
          <Grid flow="column" align="center" gap="md">
            <Button onClick={() => setIsConfirmingTurnOff(false)}>
              {t('Keep it on')}
            </Button>
            <Button
              variant="danger"
              busy={isPending}
              onClick={() => save({...autoTopUp, enabled: false})}
            >
              {t('Turn off')}
            </Button>
          </Grid>
        </Footer>
      </Fragment>
    );
  }

  const reloadPrice = displayPriceWithCents({cents: reloadCents});

  return (
    <Fragment>
      <Header closeButton>
        <Stack gap="xs">
          <Heading as="h2" size="xl">
            {t('Seer auto-reload')}
          </Heading>
          <Text variant="muted">
            {t(
              'Add credits automatically when your balance runs low, for uninterrupted Seer usage'
            )}
          </Text>
        </Stack>
      </Header>
      <Body>
        <Stack gap="2xl">
          {error && (
            <Alert variant="danger" showIcon={false}>
              {error}
            </Alert>
          )}
          <Stack gap="lg">
            <Stack gap="xs">
              <Text as="label" htmlFor="seer-auto-reload-amount" bold>
                {t('Reload amount')}
              </Text>
              {isTurningOn && (
                <Text>
                  {tct('Added when your balance drops below [threshold], plus tax.', {
                    threshold: displayPrice({
                      cents: autoTopUp.thresholdCredits * creditPriceCents,
                    }),
                  })}
                </Text>
              )}
            </Stack>
            <Stack gap="md">
              <Flex role="group" aria-label={t('Reload amount presets')} gap="sm">
                {RELOAD_PRESETS_CENTS.map(cents => {
                  const isSelected = cents === reloadCents;
                  const label = displayPrice({cents});
                  return (
                    <Button
                      key={cents}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setReloadCents(cents);
                        // The API rejects a daily limit that can't cover one reload.
                        setDailyLimitCents(limit => Math.max(limit, cents));
                      }}
                    >
                      {isSelected ? <Text variant="accent">{label}</Text> : label}
                    </Button>
                  );
                })}
              </Flex>
              <DollarInput
                id="seer-auto-reload-amount"
                cents={reloadCents}
                creditPriceCents={creditPriceCents}
                onChange={setReloadCents}
              />
            </Stack>
          </Stack>
          <Stack gap="lg">
            <Stack gap="xs">
              <Text as="label" htmlFor="seer-auto-reload-daily-limit" bold>
                {t('Daily usage limit')}
              </Text>
              {isTurningOn && (
                <Text>{t('If Seer uses this much, pause until the next day')}</Text>
              )}
            </Stack>
            <DollarInput
              id="seer-auto-reload-daily-limit"
              cents={dailyLimitCents}
              creditPriceCents={creditPriceCents}
              onChange={setDailyLimitCents}
            />
          </Stack>
          {isChargedNow && (
            <Stack
              gap="md"
              padding="lg"
              background="secondary"
              border="muted"
              radius="md"
            >
              <Flex justify="between" align="center" gap="xl">
                <Text size="lg" bold>
                  {t('Due now')}
                </Text>
                <Text size="lg" bold>
                  {tct('[price] + tax', {price: reloadPrice})}
                </Text>
              </Flex>
              <Text size="sm" variant="muted">
                {t('Purchased credits expire after 12 months')}
              </Text>
            </Stack>
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex justify={isTurningOn ? 'end' : 'between'} align="center" width="100%">
          {!isTurningOn && (
            <Button variant="link" onClick={() => setIsConfirmingTurnOff(true)}>
              {t('Turn off auto-reload')}
            </Button>
          )}
          <Grid flow="column" align="center" gap="md">
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              variant="primary"
              busy={isPending}
              disabled={reloadCents <= 0}
              onClick={() =>
                save({
                  enabled: true,
                  thresholdCredits: autoTopUp.thresholdCredits,
                  topUpCredits: Math.floor(reloadCents / creditPriceCents),
                  dailySpendCapCents: dailyLimitCents,
                })
              }
            >
              {isChargedNow
                ? tct('Turn on and pay [price] + tax', {price: reloadPrice})
                : isTurningOn
                  ? t('Turn on')
                  : t('Save')}
            </Button>
          </Grid>
        </Flex>
      </Footer>
    </Fragment>
  );
}

function DollarInput({
  id,
  cents,
  creditPriceCents,
  onChange,
}: {
  cents: number;
  creditPriceCents: number;
  id: string;
  onChange: (cents: number) => void;
}) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Text variant="muted">$</Text>
      </InputGroup.LeadingItems>
      <InputGroup.Input
        id={id}
        inputMode="numeric"
        value={(cents / 100).toLocaleString()}
        onChange={e => onChange(parseWholeNumber(e.target.value) * 100)}
      />
      <InputGroup.TrailingItems disablePointerEvents>
        <Text variant="muted">
          {tct('[credits] credits', {
            credits: Math.floor(cents / creditPriceCents).toLocaleString(),
          })}
        </Text>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

const modalCss = css`
  width: 480px;
`;

export function openSeerAutoTopUpModal(options: AutoTopUpModalOptions) {
  openModal(deps => <AutoTopUpModal {...deps} {...options} />, {
    modalCss,
  });
}
