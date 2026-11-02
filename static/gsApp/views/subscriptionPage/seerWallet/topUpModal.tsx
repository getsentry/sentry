import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {openModal, type ModalRenderProps} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {
  AutoTopUpModal,
  autoTopUpModalCss,
} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import {
  seerWalletAutoTopUpOptions,
  seerWalletBalanceOptions,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

interface TopUpModalOptions {
  organization: Organization;
}

/**
 * The billing page's auto-reload modal, opened wherever Seer runs out of
 * credits. Unlike the billing page it has no wallet card behind it, so it loads
 * the wallet itself.
 */
function TopUpModal(props: TopUpModalOptions & ModalRenderProps) {
  const {Header, Body, organization} = props;
  const balanceQuery = useQuery(seerWalletBalanceOptions(organization));
  const autoTopUpQuery = useQuery(seerWalletAutoTopUpOptions(organization));

  // The wallet only includes credit pricing for billing roles, the only ones
  // the CTA offers auto-reload to.
  const creditPriceCents = balanceQuery.data?.creditPriceCents;

  if (balanceQuery.data && autoTopUpQuery.data && creditPriceCents !== undefined) {
    return (
      <AutoTopUpModal
        {...props}
        autoTopUp={autoTopUpQuery.data}
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

export function openSeerTopUpModal(options: TopUpModalOptions) {
  openModal(deps => <TopUpModal {...deps} {...options} />, {
    modalCss: autoTopUpModalCss,
  });
}
