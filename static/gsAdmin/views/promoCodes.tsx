import moment from 'moment-timezone';

import {openModal} from 'sentry/actionCreators/modal';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';

import PageHeader from 'admin/components/pageHeader';
import PromoCodeModal from 'admin/components/promoCodes/promoCodeModal';
import ResultGrid from 'admin/components/resultGrid';
import titleCase from 'getsentry/utils/titleCase';

const getRow = (row: any) => [
  <td key="code">
    <strong>
      <Link to={`/_admin/promocodes/${row.code}/`}>{row.code}</Link>
    </strong>
    {row.status === 'active' ? null : <Tag variant="danger">{titleCase(row.status)}</Tag>}
    <br />
    {row.campaign ? <small>{row.campaign}</small> : null}
  </td>,
  <td key="value" style={{textAlign: 'center'}}>
    {row.trialDays ? `${row.trialDays} days` : row.amount ? `$${row.amount}` : 'n/a'}
  </td>,
  <td key="claims" style={{textAlign: 'center'}}>
    {row.numClaims}
    {row.maxClaims ? ` / ${row.maxClaims}` : null}
  </td>,
  <td key="expires" style={{textAlign: 'right'}}>
    {row.dateExpires ? moment(row.dateExpires).fromNow() : 'never'}
  </td>,
  <td key="created" style={{textAlign: 'right'}}>
    {moment(row.dateCreated).fromNow()}
  </td>,
  <td key="creator" style={{textAlign: 'right'}}>
    <Link
      aria-label={row.userEmail ? undefined : 'Created By'}
      to={`/_admin/users/${row.userId}/`}
    >
      {row.userEmail}
    </Link>
  </td>,
];

function PromoCodes() {
  return (
    <div>
      <PageHeader title="Promo Codes">
        <Button
          onClick={() => openModal(deps => <PromoCodeModal {...deps} />)}
          priority="primary"
          size="sm"
        >
          Create Promo Code
        </Button>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/promocodes/"
        endpoint="/promocodes/"
        method="GET"
        columns={[
          <th key="code">Code</th>,
          <th key="value" style={{width: 100, textAlign: 'center'}}>
            Value
          </th>,
          <th key="claims" style={{width: 100, textAlign: 'center'}}>
            Claims
          </th>,
          <th key="expires" style={{width: 200, textAlign: 'right'}}>
            Expires
          </th>,
          <th key="created" style={{width: 200, textAlign: 'right'}}>
            Created
          </th>,
          <th key="creator" style={{width: 200, textAlign: 'right'}}>
            Created By
          </th>,
        ]}
        columnsForRow={getRow}
        hasSearch
        sortOptions={[
          ['date', 'Date Created'],
          ['claims', 'Claims'],
        ]}
        defaultSort="date"
      />
    </div>
  );
}

export default PromoCodes;
