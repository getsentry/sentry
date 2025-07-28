import moment from 'moment-timezone';

import {Link} from 'sentry/components/core/link';
import type {User} from 'sentry/types/user';

import CustomerContact from 'admin/components/customerContact';
import ResultGrid from 'admin/components/resultGrid';
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
      <td key="customer">(unknown organization)</td>,
      <td key="clamimant">
        {user ? <CustomerContact owner={user} /> : '(unknown user)'}
      </td>,
      <td key="date" style={{textAlign: 'right'}}>
        {moment(row.dateCreated).format('MMMM YYYY')}
        <br />
      </td>,
    ];
  }

  return [
    <td key="customer">
      <strong>
        <Link to={`/_admin/customers/${customer.slug}/`}>
          {customer.name || customer.slug}
        </Link>
      </strong>
      <small> — {customer.slug}</small>
    </td>,
    <td key="claimant">{user ? <CustomerContact owner={user} /> : '(unknown user)'}</td>,
    <td key="date" style={{textAlign: 'right'}}>
      {moment(row.dateCreated).format('MMMM YYYY')}
      <br />
    </td>,
  ];
};

function PromoCodeClaimants({promoCode}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Claimants"
      path={`/_admin/promocodes/${promoCode.code}/claimants/`}
      endpoint={`/promocodes/${promoCode.code}/claimants/`}
      method="GET"
      columns={[
        <th key="customer">Customer</th>,
        <th key="claimant">Claimant</th>,
        <th key="date" style={{width: 200, textAlign: 'right'}}>
          Date Claimed
        </th>,
      ]}
      columnsForRow={getRow}
      defaultParams={{
        per_page: 10,
      }}
      useQueryString={false}
    />
  );
}

export default PromoCodeClaimants;
