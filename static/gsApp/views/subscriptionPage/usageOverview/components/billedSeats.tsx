import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {
  AddOnCategory,
  type BillingSeatAssignment,
  type Subscription,
} from 'getsentry/types';
import {normalizeMetricHistory} from 'getsentry/utils/billing';

const BILLED_SEAT_COLUMNS: TableColumnConfig[] = [
  {key: 'activeContributors', width: '1fr'},
  {key: 'dateAdded', width: '1fr'},
];

export function BilledSeats({
  selectedProduct,
  subscription,
  organization,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
}) {
  const {billedCategory, isEnabled, activeProductTrial} = useProductBillingMetadata(
    subscription,
    selectedProduct
  );
  const shouldShowBilledSeats =
    selectedProduct === AddOnCategory.SEER && defined(billedCategory) && isEnabled;
  const {
    data,
    isPending: seatsLoading,
    error: seatsError,
    refetch,
  } = useQuery({
    ...apiOptions.as<BillingSeatAssignment[]>()(
      '/customers/$organizationIdOrSlug/billing-seats/current/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {billingMetric: billedCategory},
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
    enabled: shouldShowBilledSeats,
  });
  const billedSeats = data?.json;

  if (!shouldShowBilledSeats) {
    // eventually we should expand this to support other seat-based products
    return null;
  }

  const metricHistory = subscription.categories[billedCategory];
  const normalizedMetricHistory = normalizeMetricHistory(billedCategory, metricHistory);

  return (
    <Fragment>
      <Table
        columns={BILLED_SEAT_COLUMNS}
        hasBorderTop={
          // add a top border if there is info above this component in the panel
          // we can infer this by checking if there is at least one billed seat
          // (info includes accumulated spend) or by checking that the prepaid
          // volume for the seat category is greater than 0 (info includes reserved
          // and gifted volumes)
          (billedSeats?.length ?? 0) > 0 ||
          !!activeProductTrial ||
          (defined(normalizedMetricHistory.prepaid) &&
            (normalizedMetricHistory.prepaid > 0 ||
              normalizedMetricHistory.prepaid === UNLIMITED_RESERVED))
        }
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell style={{textTransform: 'uppercase'}}>
              {tct('Active Contributors ([count])', {count: billedSeats?.length ?? 0})}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell style={{textTransform: 'uppercase'}}>
              {t('Date Added')}
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {seatsError ? (
          <SimpleTable.Error onRetry={refetch} />
        ) : seatsLoading ? (
          <SimpleTable.Loading />
        ) : billedSeats && billedSeats.length > 0 ? (
          billedSeats.map(seat => (
            <SimpleTable.Row key={seat.id}>
              <SimpleTable.RowCell>@{seat.displayName}</SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <TimeSince date={seat.created} />
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))
        ) : (
          <SimpleTable.Empty>
            <Text variant="muted">{t('No billed usage recorded yet.')}</Text>
          </SimpleTable.Empty>
        )}
      </Table>
      {billedSeats && billedSeats.length > 0 && (
        <Container padding="0 lg lg" borderTop="primary">
          <Pagination pageLinks={data?.headers.Link ?? null} />
        </Container>
      )}
    </Fragment>
  );
}

const Table = styled(SimpleTable)<{hasBorderTop: boolean}>`
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  border: none;
  border-top: ${p =>
    p.hasBorderTop ? `1px solid ${p.theme.tokens.border.primary}` : 'none'};
`;
