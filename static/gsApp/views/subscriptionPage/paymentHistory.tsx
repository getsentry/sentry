import {Fragment, useEffect} from 'react';
import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {
  IconCheckmark,
  IconClose,
  IconDownload,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import withSubscription from 'getsentry/components/withSubscription';
import type {InvoiceBase, Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import formatCurrency from 'getsentry/utils/formatCurrency';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

import SubscriptionHeader from './subscriptionHeader';
import {trackSubscriptionView} from './utils';

type Props = {
  organization: Organization;
  subscription: Subscription;
} & RouteComponentProps<unknown, unknown>;

enum ReceiptStatus {
  PAID = 'paid',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
  AWAITING_PAYMENT = 'awaiting_payment',
}

/**
 * Invoice/Payment list view.
 */
function PaymentHistory({organization, subscription}: Props) {
  const isNewBillingUI = hasNewBillingUI(organization);
  const location = useLocation();

  useEffect(() => {
    trackSubscriptionView(organization, subscription, 'receipts');
  }, [organization, subscription]);

  const {
    data: payments,
    isPending,
    isError,
    getResponseHeader,
  } = useApiQuery<InvoiceBase[]>(
    [
      `/customers/${organization.slug}/invoices/`,
      {
        query: {cursor: location.query.cursor},
      },
    ],
    {
      staleTime: 0,
    }
  );

  const hasBillingPerms = organization.access?.includes('org:billing');
  const paymentsPageLinks = getResponseHeader?.('Link');

  if (!isNewBillingUI) {
    if (isPending) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <SubscriptionHeader subscription={subscription} organization={organization} />
          <LoadingIndicator />
        </SubscriptionPageContainer>
      );
    }

    if (isError) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <LoadingError />
        </SubscriptionPageContainer>
      );
    }

    if (!hasBillingPerms) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <ContactBillingMembers />
        </SubscriptionPageContainer>
      );
    }

    return (
      <SubscriptionPageContainer background="primary" organization={organization}>
        <SubscriptionHeader organization={organization} subscription={subscription} />
        <ReceiptGrid
          payments={payments}
          organization={organization}
          paymentsPageLinks={paymentsPageLinks}
        />
      </SubscriptionPageContainer>
    );
  }

  return (
    <SubscriptionPageContainer background="primary" organization={organization}>
      <SentryDocumentTitle title={t('Receipts')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Receipts')} />
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError />
      ) : hasBillingPerms ? (
        <ReceiptGrid
          payments={payments}
          organization={organization}
          paymentsPageLinks={paymentsPageLinks}
        />
      ) : (
        <ContactBillingMembers />
      )}
    </SubscriptionPageContainer>
  );
}

function ReceiptGrid({
  payments,
  organization,
  paymentsPageLinks,
}: {
  organization: Organization;
  payments: InvoiceBase[];
  paymentsPageLinks: string | null | undefined;
}) {
  const theme = useTheme();
  const isMobile = useMedia(`(width < ${theme.breakpoints.md})`);

  const getTag = (payment: InvoiceBase) => {
    const status = payment.amountRefunded
      ? ReceiptStatus.REFUNDED
      : payment.isPaid
        ? ReceiptStatus.PAID
        : payment.isClosed
          ? ReceiptStatus.CLOSED
          : ReceiptStatus.AWAITING_PAYMENT;
    let icon = <IconWarning />;
    let tagType = 'warning';

    switch (status) {
      case ReceiptStatus.PAID:
        icon = <IconCheckmark />;
        tagType = 'success';
        break;
      case ReceiptStatus.CLOSED:
        icon = <IconClose />;
        tagType = 'error';
        break;
      case ReceiptStatus.REFUNDED:
        icon = <IconTimer />;
        tagType = 'promotion';
        break;
      default:
        icon = <IconWarning />;
        tagType = 'warning';
        break;
    }

    return (
      <Tag icon={icon} type={tagType as any}>
        {capitalize(status.replace('_', ' '))}
      </Tag>
    );
  };

  return (
    <Fragment>
      <Flex
        border="primary"
        radius="md"
        direction="column"
        background="primary"
        data-test-id="payment-list"
      >
        <Grid
          align="center"
          columns={isMobile ? 'repeat(5, 1fr)' : 'repeat(4, 1fr) 2fr'}
          gap="xl"
          padding="xl"
        >
          <Text bold>{t('Date')}</Text>
          <Text bold align="right">
            {t('Amount')}
          </Text>
          <Text bold>{t('Status')}</Text>
          <Text bold>{t('Receipt ID')}</Text>
          <div />
        </Grid>
        {payments.map(payment => {
          const url = `/settings/${organization.slug}/billing/receipts/${payment.id}/`;
          return (
            <Grid
              key={payment.id}
              align="center"
              columns={isMobile ? 'repeat(5, 1fr)' : 'repeat(4, 1fr) 2fr'}
              gap="xl"
              borderTop="primary"
              padding="xl"
            >
              <Link to={url}>{moment(payment.dateCreated).format('MMM D, YYYY')}</Link>
              <Container>
                <Text align="right">{formatCurrency(payment.amountBilled ?? 0)}</Text>
                {!!payment.amountRefunded && (
                  <Text size="sm" align="right">
                    {tct('[amount] refunded', {
                      amount: formatCurrency(payment.amountRefunded),
                    })}
                  </Text>
                )}
              </Container>
              <Container>{getTag(payment)}</Container>
              <Text monospace ellipsis>
                {payment.id}
              </Text>
              <Flex justify="end">
                <LinkButton icon={<IconDownload />} href={payment.receipt.url}>
                  {isMobile ? undefined : t('Download PDF')}
                </LinkButton>
              </Flex>
            </Grid>
          );
        })}
      </Flex>
      {payments.length === 0 && <Text>{t('No receipts found')}</Text>}
      {paymentsPageLinks && <Pagination pageLinks={paymentsPageLinks} />}
    </Fragment>
  );
}

export default withOrganization(withSubscription(PaymentHistory));
