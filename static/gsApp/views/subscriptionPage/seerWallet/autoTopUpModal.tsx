import {Fragment, useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {displayPrice} from 'getsentry/utils/billing';
import {
  seerWalletAutoTopUpOptions,
  type SeerWalletAutoTopUp,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

const TOP_UP_PRESETS = [1000, 2000, 5000];

interface AutoTopUpModalOptions {
  autoTopUp: SeerWalletAutoTopUp;
  creditPriceCents: number;
  organization: Organization;
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
}: AutoTopUpModalProps) {
  const queryClient = useQueryClient();
  // Both entry points ("Turn on auto top-up" and "Edit") expect auto top-up to end up on.
  const [enabled, setEnabled] = useState(true);
  const [thresholdCredits, setThresholdCredits] = useState(autoTopUp.thresholdCredits);
  const [topUpCredits, setTopUpCredits] = useState(autoTopUp.topUpCredits);
  const [dailySpendCapDollars, setDailySpendCapDollars] = useState(
    Math.floor(autoTopUp.dailySpendCapCents / 100)
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
      addSuccessMessage(
        data.enabled ? t('Auto top-up turned on') : t('Auto top-up turned off')
      );
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
          : t('Unable to save your auto top-up settings.')
      );
    },
  });

  const topUpCostCents = topUpCredits * creditPriceCents;

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h2">{t('Seer credits')}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          {error && (
            <Alert variant="danger" showIcon={false}>
              {error}
            </Alert>
          )}
          <Stack gap="sm">
            <Flex justify="between" align="center" gap="md">
              <Heading as="h3" size="lg">
                {t('Auto top-up')}
              </Heading>
              <Switch
                size="lg"
                aria-label={t('Auto top-up')}
                checked={enabled}
                onChange={() => setEnabled(!enabled)}
              />
            </Flex>
            <Text variant="muted">
              {t(
                'Automatically buy credits when your balance runs low, so Seer keeps running.'
              )}
            </Text>
          </Stack>
          <Separator orientation="horizontal" border="primary" />
          <Stack gap="sm">
            <Text as="label" htmlFor="seer-auto-top-up-threshold">
              {t('If credits fall below:')}
            </Text>
            <InputGroup>
              <InputGroup.Input
                id="seer-auto-top-up-threshold"
                inputMode="numeric"
                disabled={!enabled}
                value={thresholdCredits.toLocaleString()}
                onChange={e => setThresholdCredits(parseWholeNumber(e.target.value))}
              />
              <InputGroup.TrailingItems disablePointerEvents>
                <Text variant="muted">{t('credits')}</Text>
              </InputGroup.TrailingItems>
            </InputGroup>
          </Stack>
          <Stack gap="sm">
            <Flex justify="between" align="center" gap="md">
              <Text as="label" htmlFor="seer-auto-top-up-amount">
                {t('Top up by:')}
              </Text>
              <SegmentedControl
                size="xs"
                aria-label={t('Top-up presets')}
                value={String(topUpCredits)}
                onChange={value => setTopUpCredits(Number(value))}
              >
                {TOP_UP_PRESETS.map(preset => (
                  <SegmentedControl.Item key={String(preset)} disabled={!enabled}>
                    {preset.toLocaleString()}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl>
            </Flex>
            <InputGroup>
              <InputGroup.Input
                id="seer-auto-top-up-amount"
                inputMode="numeric"
                disabled={!enabled}
                value={topUpCredits.toLocaleString()}
                onChange={e => setTopUpCredits(parseWholeNumber(e.target.value))}
              />
              <InputGroup.TrailingItems disablePointerEvents>
                <Text variant="muted">{t('credits')}</Text>
              </InputGroup.TrailingItems>
            </InputGroup>
            <Text variant="muted">
              {tct('[cost] per top-up • (1 credit = [creditPrice])', {
                cost: displayPrice({cents: topUpCostCents}),
                creditPrice: displayPrice({cents: creditPriceCents}),
              })}
            </Text>
          </Stack>
          <Separator orientation="horizontal" border="primary" />
          <Stack gap="sm">
            <Text as="label" htmlFor="seer-auto-top-up-daily-cap">
              {t('Daily spending cap')}
            </Text>
            <InputGroup>
              <InputGroup.LeadingItems disablePointerEvents>
                <Text variant="muted">$</Text>
              </InputGroup.LeadingItems>
              <InputGroup.Input
                id="seer-auto-top-up-daily-cap"
                inputMode="numeric"
                disabled={!enabled}
                value={dailySpendCapDollars.toLocaleString()}
                onChange={e => setDailySpendCapDollars(parseWholeNumber(e.target.value))}
              />
            </InputGroup>
          </Stack>
          {enabled && (
            <Text size="sm" variant="muted">
              {tct(
                "We'll charge your payment method [cost] each time your balance falls below [threshold] credits, up to [cap] per day. You can turn off auto top-up at any time.",
                {
                  cost: displayPrice({cents: topUpCostCents}),
                  threshold: thresholdCredits.toLocaleString(),
                  cap: displayPrice({cents: dailySpendCapDollars * 100}),
                }
              )}
            </Text>
          )}
        </Stack>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            busy={isPending}
            onClick={() =>
              save({
                enabled,
                thresholdCredits,
                topUpCredits,
                dailySpendCapCents: dailySpendCapDollars * 100,
              })
            }
          >
            {t('Save')}
          </Button>
        </Grid>
      </Footer>
    </Fragment>
  );
}

export function openSeerAutoTopUpModal(options: AutoTopUpModalOptions) {
  openModal(deps => <AutoTopUpModal {...deps} {...options} />);
}
