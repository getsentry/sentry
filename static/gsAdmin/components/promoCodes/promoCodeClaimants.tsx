import moment from 'moment-timezone';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {User} from 'sentry/types/user';

import {CustomerContact} from 'admin/components/customerContact';
import type {PromoCode} from 'admin/types';

type Props = {
  promoCode: PromoCode;
};

type PromoClaimant = {
  customer: {
    name: string;
    slug: string;
  };
  dateCreated: string;
  id: string;
  user: User;
};

const getRow = (row: PromoClaimant) => {
  const {customer, user} = row;

  if (!customer) {
    return [
      <SimpleTable.RowCell key="customer">(unknown organization)</SimpleTable.RowCell>,
      <SimpleTable.RowCell key="clamimant">
        {user ? <CustomerContact owner={user} /> : '(unknown user)'}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="date" justify="end">
        {moment(row.dateCreated).format('MMMM YYYY')}
      </SimpleTable.RowCell>,
    ];
  }

  return [
    <SimpleTable.RowCell key="customer">
      <Text>
        <strong>
          <Link to={`/_admin/customers/${customer.slug}/`}>
            {customer.name || customer.slug}
          </Link>
        </strong>
        <Text size="xs"> — {customer.slug}</Text>
      </Text>
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="claimant">
      {user ? <CustomerContact owner={user} /> : '(unknown user)'}
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="date" justify="end">
      {moment(row.dateCreated).format('MMMM YYYY')}
    </SimpleTable.RowCell>,
  ];
};

export function PromoCodeClaimants({promoCode}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Claimants"
      path={`/_admin/promocodes/${promoCode.code}/claimants/`}
      endpoint={`/promocodes/${promoCode.code}/claimants/`}
      columns={[
        {key: 'customer', label: 'Customer'},
        {key: 'claimant', label: 'Claimant'},
        {key: 'date', label: 'Date Claimed', width: 200, align: 'right'},
      ]}
      columnsForRow={getRow}
      defaultParams={{
        per_page: 10,
      }}
      useQueryString={false}
    />
  );
}
