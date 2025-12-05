import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {
  AddOnCategory,
  type BillingSeatAssignment,
  type Subscription,
} from 'getsentry/types';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

function BilledSeats({
  selectedProduct,
  subscription,
  organization,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
}) {
  const {billedCategory, activeProductTrial} = useProductBillingMetadata(
    subscription,
    selectedProduct
  );
  const billedSeatsQueryKey = [
    `/customers/${organization.slug}/billing-seats/current/?billingMetric=${billedCategory}`,
  ] as const;
  const {
    data: billedSeats,
    isPending: seatsLoading,
    error: seatsError,
    refetch,
    getResponseHeader,
  } = useApiQuery<BillingSeatAssignment[]>(billedSeatsQueryKey, {
    staleTime: 0,
    enabled: selectedProduct === AddOnCategory.SEER,
  });

  if (selectedProduct !== AddOnCategory.SEER) {
    // eventually we should expand this to support other seat-based products
    return null;
  }

  return (
    <Fragment>
      <Table>
        <SimpleTable.Header
          style={{borderBottom: billedSeats?.length === 0 ? 'none' : undefined}}
        >
          <SimpleTable.HeaderCell style={{textTransform: 'uppercase'}}>
            {tct('Active Contributors[stats]', {
              stats: ` (${billedSeats?.length ?? 0})${activeProductTrial ? t(' | Unlimited') : subscription.canSelfServe ? ` | ${displayPrice({cents: (billedSeats?.length ?? 0) * 40_00})}` : ''}`,
            })}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell style={{textTransform: 'uppercase'}}>
            {t('Date Added')}
          </SimpleTable.HeaderCell>
        </SimpleTable.Header>
        {seatsError && (
          <SimpleTable.Empty>
            <LoadingError onRetry={refetch} />
          </SimpleTable.Empty>
        )}
        {seatsLoading && (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        )}
        {billedSeats?.map(seat => (
          <SimpleTable.Row key={seat.id}>
            <SimpleTable.RowCell>@{seat.displayName}</SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <TimeSince date={seat.created} />
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </Table>
      {billedSeats && billedSeats.length > 0 && (
        <Container padding="0 lg lg" borderTop="primary">
          <Pagination pageLinks={getResponseHeader?.('Link') ?? null} />
        </Container>
      )}
    </Fragment>
  );
}

export default BilledSeats;

const Table = styled(SimpleTable)`
  grid-template-columns: 1fr 1fr;
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  border: none;
`;
