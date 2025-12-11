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
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';

import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {
  AddOnCategory,
  type BillingSeatAssignment,
  type Subscription,
} from 'getsentry/types';

function BilledSeats({
  selectedProduct,
  subscription,
  organization,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
}) {
  const {billedCategory, isEnabled} = useProductBillingMetadata(
    subscription,
    selectedProduct
  );
  const shouldShowBilledSeats =
    selectedProduct === AddOnCategory.SEER && defined(billedCategory) && isEnabled;
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
    enabled: shouldShowBilledSeats,
  });

  if (!shouldShowBilledSeats) {
    // eventually we should expand this to support other seat-based products
    return null;
  }

  return (
    <Fragment>
      <Table hasBorderTop={(billedSeats?.length ?? 0) > 0}>
        <SimpleTable.Header
          style={{
            borderBottom: billedSeats?.length === 0 ? 'none' : undefined,
          }}
        >
          <SimpleTable.HeaderCell style={{textTransform: 'uppercase'}}>
            {tct('Active Contributors ([count])', {count: billedSeats?.length ?? 0})}
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

const Table = styled(SimpleTable)<{hasBorderTop: boolean}>`
  grid-template-columns: 1fr 1fr;
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  border: none;
  border-top: ${p => (p.hasBorderTop ? `1px solid ${p.theme.border}` : 'none')};
`;
