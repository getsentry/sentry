import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {openModal, type ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {displayPrice, displayPriceWithCents} from 'getsentry/utils/billing';
import {
  seerWalletAutoTopUpOptions,
  type SeerWalletAutoTopUp,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

const RELOAD_PRESET_DOLLARS = [10, 25, 50, 150];

interface AutoTopUpModalOptions {
  autoTopUp: SeerWalletAutoTopUp;
  creditPriceCents: number;
  organization: Organization;
  purchasedExpiresAt: string | null;
}

type AutoTopUpModalProps = AutoTopUpModalOptions & ModalRenderProps;

function parseWholeNumber(value: string) {
  return Math.max(0, parseInt(value.replace(/\D/g, ''), 10) || 0);
}

function AutoTopUpModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  autoTopUp,
  creditPriceCents,
  purchasedExpiresAt,
}: AutoTopUpModalProps) {
  const queryClient = useQueryClient();
  const isEditing = autoTopUp.enabled;
  const [isConfirmingTurnOff, setIsConfirmingTurnOff] = useState(false);
  const [reloadDollars, setReloadDollars] = useState(
    Math.floor((autoTopUp.topUpCredits * creditPriceCents) / 100)
  );
  const [dailyLimitDollars, setDailyLimitDollars] = useState(
    Math.floor(autoTopUp.dailySpendCapCents / 100)
  );
  const [error, setError] = useState<string | null>(null);

  const dollarsToCredits = (dollars: number) =>
    creditPriceCents > 0 ? Math.floor((dollars * 100) / creditPriceCents) : 0;
  const topUpCredits = dollarsToCredits(reloadDollars);
  const reloadCostCents = topUpCredits * creditPriceCents;

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
      if (!data.enabled) {
        toast.success(t('Auto-reload turned off'));
      } else if (isEditing) {
        toast.success(t('Auto-reload updated'));
      } else {
        toast.success(t('Auto-reload turned on'));
      }
      closeModal();
    },
    onError: err => {
      const fieldErrors =
        err instanceof RequestError
          ? (err.responseJSON as Record<string, string[]> | undefined)
          : undefined;
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
          <Heading as="h2">{t('Turn off auto-reload?')}</Heading>
        </Header>
        <Body>
          <Stack gap="xl">
            {error && (
              <Alert variant="danger" showIcon={false}>
                {error}
              </Alert>
            )}
            <Text>
              {purchasedExpiresAt
                ? tct(
                    'Your balance will remain, and expires on [date]. When it runs out, Seer pauses until your included credits reset.',
                    {date: moment(purchasedExpiresAt).format('MMM D, YYYY')}
                  )
                : t(
                    'Your balance will remain. When it runs out, Seer pauses until your included credits reset.'
                  )}
            </Text>
          </Stack>
        </Body>
        <Footer>
          <Grid flow="column" align="center" gap="md">
            <Button
              onClick={() => {
                setError(null);
                setIsConfirmingTurnOff(false);
              }}
            >
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

  const submit = () =>
    save({
      enabled: true,
      thresholdCredits: autoTopUp.thresholdCredits,
      topUpCredits,
      dailySpendCapCents: dailyLimitDollars * 100,
    });

  return (
    <Fragment>
      <Header closeButton>
        <Stack gap="sm">
          <Heading as="h2">{t('Seer auto-reload')}</Heading>
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
          <Stack gap="md">
            <Stack gap="xs">
              <Text as="label" htmlFor="seer-auto-reload-amount" bold>
                {t('Reload amount')}
              </Text>
              {!isEditing && (
                <Text>
                  {tct('Added when your balance drops below [threshold], plus tax.', {
                    threshold: displayPrice({
                      cents: autoTopUp.thresholdCredits * creditPriceCents,
                    }),
                  })}
                </Text>
              )}
            </Stack>
            <Flex role="group" aria-label={t('Reload amount presets')} gap="md">
              {RELOAD_PRESET_DOLLARS.map(preset => {
                const isSelected = preset === reloadDollars;
                return (
                  <Button
                    key={preset}
                    aria-pressed={isSelected}
                    onClick={() => setReloadDollars(preset)}
                  >
                    <Text variant={isSelected ? 'accent' : 'inherit'}>
                      {displayPrice({cents: preset * 100})}
                    </Text>
                  </Button>
                );
              })}
            </Flex>
            <DollarCreditsInput
              id="seer-auto-reload-amount"
              dollars={reloadDollars}
              credits={topUpCredits}
              onChange={setReloadDollars}
            />
          </Stack>
          <Stack gap="md">
            <Stack gap="xs">
              <Text as="label" htmlFor="seer-auto-reload-daily-limit" bold>
                {t('Daily usage limit')}
              </Text>
              {!isEditing && (
                <Text>{t('If Seer uses this much, pause until the next day')}</Text>
              )}
            </Stack>
            <DollarCreditsInput
              id="seer-auto-reload-daily-limit"
              dollars={dailyLimitDollars}
              credits={dollarsToCredits(dailyLimitDollars)}
              onChange={setDailyLimitDollars}
            />
          </Stack>
          {!isEditing && (
            <Container background="secondary" border="primary" radius="md" padding="xl">
              <Stack gap="md">
                <Flex justify="between" align="center" gap="md">
                  <Heading as="h3" size="lg">
                    {t('Due now')}
                  </Heading>
                  <Text size="lg" bold>
                    {tct('[cost] + tax', {
                      cost: displayPriceWithCents({cents: reloadCostCents}),
                    })}
                  </Text>
                </Flex>
                <Stack gap="sm">
                  <Text>
                    {tct('[cost] in credits, plus applicable tax', {
                      cost: displayPriceWithCents({cents: reloadCostCents}),
                    })}
                  </Text>
                  <Text size="sm" variant="muted">
                    {t('Purchased credits expire after 12 months')}
                  </Text>
                </Stack>
              </Stack>
            </Container>
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex flex="1" justify={isEditing ? 'between' : 'end'} align="center" gap="md">
          {isEditing && (
            <Button
              variant="link"
              onClick={() => {
                setError(null);
                setIsConfirmingTurnOff(true);
              }}
            >
              {t('Turn off auto-reload')}
            </Button>
          )}
          <Grid flow="column" align="center" gap="md">
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button variant="primary" busy={isPending} onClick={submit}>
              {isEditing
                ? t('Save')
                : tct('Turn on and pay [cost] + tax', {
                    cost: displayPriceWithCents({cents: reloadCostCents}),
                  })}
            </Button>
          </Grid>
        </Flex>
      </Footer>
    </Fragment>
  );
}

function DollarCreditsInput({
  id,
  dollars,
  credits,
  onChange,
}: {
  credits: number;
  dollars: number;
  id: string;
  onChange: (dollars: number) => void;
}) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Text variant="muted">$</Text>
      </InputGroup.LeadingItems>
      <InputGroup.Input
        id={id}
        inputMode="numeric"
        value={dollars.toLocaleString()}
        onChange={e => onChange(parseWholeNumber(e.target.value))}
      />
      <InputGroup.TrailingItems disablePointerEvents>
        <Text variant="muted">
          {tct('[credits] credits', {credits: credits.toLocaleString()})}
        </Text>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

// The dialog's own padding sits outside the visible surface, so this makes the
// surface 480px wide.
const modalCss = css`
  width: 100%;
  max-width: 512px;
`;

export function openSeerAutoTopUpModal(options: AutoTopUpModalOptions) {
  openModal(deps => <AutoTopUpModal {...deps} {...options} />, {modalCss});
}
