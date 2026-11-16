import {Fragment, useState, type ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {openModal, type ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';
import {ToggleCard} from '@sentry/scraps/toggleCard';

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
  type SeerWalletBalance,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

const DEFAULT_AMOUNT_CENTS = 1500;
const AMOUNT_PRESETS_CENTS = [DEFAULT_AMOUNT_CENTS, 2500, 5000];

interface AutoTopUpModalOptions {
  organization: Organization;
}

type AutoTopUpModalProps = AutoTopUpModalOptions & ModalRenderProps;

type AutoTopUpFormProps = AutoTopUpModalProps & {
  autoTopUp: SeerWalletAutoTopUp;
  balanceCredits: number;
  creditPriceCents: number;
  purchased: SeerWalletBalance['purchased'];
};

function parseWholeNumber(value: string) {
  return Math.max(0, parseInt(value.replace(/\D/g, ''), 10) || 0);
}

function toWholeDollarCents(cents: number) {
  return Math.floor(cents / 100) * 100;
}

function getInitialAmount(autoTopUp: SeerWalletAutoTopUp, creditPriceCents: number) {
  const savedCents = toWholeDollarCents(autoTopUp.topUpCredits * creditPriceCents);
  if (AMOUNT_PRESETS_CENTS.includes(savedCents)) {
    return {cents: savedCents, isCustom: false};
  }
  // Turning on starts from a preset rather than an amount the user never picked.
  if (!autoTopUp.enabled) {
    return {cents: DEFAULT_AMOUNT_CENTS, isCustom: false};
  }
  return {cents: savedCents, isCustom: true};
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
        purchased={balanceQuery.data.purchased}
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
          {t('Auto-reload credits')}
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
  purchased,
}: AutoTopUpFormProps) {
  const queryClient = useQueryClient();
  const isTurningOn = !autoTopUp.enabled;
  // The backend only bills an auto-reload once the balance is below the threshold.
  const isChargedNow = isTurningOn && balanceCredits < autoTopUp.thresholdCredits;
  const [isConfirmingTurnOff, setIsConfirmingTurnOff] = useState(false);
  const [initialAmount] = useState(() => getInitialAmount(autoTopUp, creditPriceCents));
  const [amountCents, setAmountCents] = useState(initialAmount.cents);
  const [isCustomAmount, setIsCustomAmount] = useState(initialAmount.isCustom);
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
      // Turning on can bill credits right away, so refresh the balance as well.
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
            <TurnOffMessage purchased={purchased} />
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

  const amountPrice = displayPriceWithCents({cents: amountCents});

  return (
    <Fragment>
      <Header closeButton>
        <Stack gap="xs">
          <Heading as="h2" size="xl">
            {t('Auto-reload credits')}
          </Heading>
          <Text size="lg" variant="muted">
            {t(
              'Automatically purchase credits when your balance is low, for uninterrupted Seer usage'
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
              <Text id="seer-auto-load-amount-label" bold>
                {t('Credit amount')}
              </Text>
              <Text>
                {tct(
                  'Whenever your credits drop below [threshold], purchase this amount',
                  {
                    threshold: displayPrice({
                      cents: autoTopUp.thresholdCredits * creditPriceCents,
                    }),
                  }
                )}
              </Text>
            </Stack>
            <Stack gap="md">
              <Grid
                role="radiogroup"
                aria-labelledby="seer-auto-load-amount-label"
                columns={`repeat(${AMOUNT_PRESETS_CENTS.length + 1}, minmax(0, 1fr))`}
                gap="sm"
              >
                {AMOUNT_PRESETS_CENTS.map(cents => {
                  const isSelected = !isCustomAmount && cents === amountCents;
                  return (
                    <AmountCard
                      key={cents}
                      value={String(cents)}
                      checked={isSelected}
                      onChange={() => {
                        setAmountCents(cents);
                        setIsCustomAmount(false);
                      }}
                    >
                      <Text bold variant={isSelected ? 'accent' : 'primary'}>
                        {displayPrice({cents})}
                      </Text>
                      <Text size="sm" variant="muted" align="center">
                        {tct('[credits] credits', {
                          credits: Math.floor(cents / creditPriceCents).toLocaleString(),
                        })}
                      </Text>
                    </AmountCard>
                  );
                })}
                <AmountCard
                  value="custom"
                  checked={isCustomAmount}
                  onChange={() => setIsCustomAmount(true)}
                >
                  <Text bold variant={isCustomAmount ? 'accent' : 'primary'}>
                    {t('Custom')}
                  </Text>
                </AmountCard>
              </Grid>
              {isCustomAmount && (
                <DollarInput
                  aria-label={t('Custom credit amount')}
                  cents={amountCents}
                  creditPriceCents={creditPriceCents}
                  onChange={setAmountCents}
                />
              )}
            </Stack>
          </Stack>
          <Stack gap="lg">
            <Stack gap="xs">
              <Text as="label" htmlFor="seer-auto-load-daily-limit" bold>
                {t('Daily usage limit')}
              </Text>
              <Text>
                {t('When reached, pause Seer usage for the day. Resets at 00:00 UTC')}
              </Text>
            </Stack>
            <DollarInput
              id="seer-auto-load-daily-limit"
              cents={dailyLimitCents}
              creditPriceCents={creditPriceCents}
              onChange={setDailyLimitCents}
            />
          </Stack>
          {isChargedNow && (
            <DueNow justify="between" align="center" gap="md" padding="lg" radius="md">
              <Stack gap="xs">
                <Text size="lg" bold>
                  {t('Due now')}
                </Text>
                <Text size="sm" variant="muted">
                  {t('Purchased credits expire after 12 months')}
                </Text>
              </Stack>
              <Stack gap="xs" align="end">
                <Text size="lg" bold>
                  {amountPrice}
                </Text>
                <Text size="sm" variant="muted">
                  {t('Plus tax')}
                </Text>
              </Stack>
            </DueNow>
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
              disabled={amountCents <= 0}
              onClick={() =>
                save({
                  enabled: true,
                  thresholdCredits: autoTopUp.thresholdCredits,
                  topUpCredits: Math.floor(amountCents / creditPriceCents),
                  dailySpendCapCents: dailyLimitCents,
                })
              }
            >
              {isChargedNow
                ? tct('Turn on and pay [price] + tax', {price: amountPrice})
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

function TurnOffMessage({purchased}: {purchased: SeerWalletBalance['purchased']}) {
  if (purchased.remaining <= 0) {
    return t('When your included credits run out, Seer pauses until they reset.');
  }

  const credits = purchased.remaining.toLocaleString();
  if (purchased.expiresAt) {
    return tct(
      'Your [credits] purchased credits will remain, and expire on [date]. When they run out, Seer pauses until your included credits reset.',
      {credits, date: moment(purchased.expiresAt).format('MMM D, YYYY')}
    );
  }
  return tct(
    'Your [credits] purchased credits will remain. When they run out, Seer pauses until your included credits reset.',
    {credits}
  );
}

function AmountCard({
  value,
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  children: ReactNode;
  onChange: () => void;
  value: string;
}) {
  return (
    <ToggleCard
      variant="radio"
      name="seer-auto-load-amount"
      value={value}
      checked={checked}
      onChange={onChange}
      padding="md lg"
    >
      <Stack align="center" justify="center" gap="xs" height="100%">
        {children}
      </Stack>
    </ToggleCard>
  );
}

function DollarInput({
  cents,
  creditPriceCents,
  onChange,
  ...inputProps
}: {
  cents: number;
  creditPriceCents: number;
  onChange: (cents: number) => void;
  'aria-label'?: string;
  id?: string;
}) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Text variant="muted">$</Text>
      </InputGroup.LeadingItems>
      <InputGroup.Input
        {...inputProps}
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

const DueNow = styled(Flex)`
  border: ${p => p.theme.border.xl} solid ${p => p.theme.tokens.border.accent.vibrant};
`;

// Leaves the 432px of content the design has inside the modal's own padding.
const modalCss = css`
  width: 528px;
`;

export function openSeerAutoTopUpModal(options: AutoTopUpModalOptions) {
  openModal(deps => <AutoTopUpModal {...deps} {...options} />, {
    modalCss,
  });
}
