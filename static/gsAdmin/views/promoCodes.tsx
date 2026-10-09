import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {PageHeader} from 'admin/components/pageHeader';
import {AddPromoCodeModal as PromoCodeModal} from 'admin/components/promoCodes/promoCodeModal';
import {titleCase} from 'getsentry/utils/titleCase';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="code" direction="column" align="start" gap="xs">
    <Flex align="center" gap="xs">
      <strong>
        <Link to={`/_admin/promocodes/${row.code}/`}>{row.code}</Link>
      </strong>
      {row.status === 'active' ? null : (
        <Tag variant="danger">{titleCase(row.status)}</Tag>
      )}
    </Flex>
    {row.campaign ? <Text size="xs">{row.campaign}</Text> : null}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="value" justify="center">
    {row.trialDays ? `${row.trialDays} days` : row.amount ? `$${row.amount}` : 'n/a'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="claims" justify="center">
    {row.numClaims}
    {row.maxClaims ? ` / ${row.maxClaims}` : null}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="expires" justify="end">
    {row.dateExpires ? moment(row.dateExpires).fromNow() : 'never'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="created" justify="end">
    {moment(row.dateCreated).fromNow()}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="creator" justify="end">
    <Link
      aria-label={row.userEmail ? undefined : 'Created By'}
      to={`/_admin/users/${row.userId}/`}
    >
      {row.userEmail}
    </Link>
  </SimpleTable.RowCell>,
];

export function PromoCodes() {
  const {openModal} = useModal();

  return (
    <div>
      <PageHeader title="Promo Codes">
        <Button
          onClick={() => openModal(deps => <PromoCodeModal {...deps} />)}
          variant="primary"
          size="sm"
        >
          Create Promo Code
        </Button>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/promocodes/"
        endpoint="/promocodes/"
        columns={[
          {key: 'code', label: 'Code'},
          {key: 'value', label: 'Value', width: 100, align: 'center'},
          {key: 'claims', label: 'Claims', width: 100, align: 'center'},
          {key: 'expires', label: 'Expires', width: 200, align: 'right'},
          {key: 'created', label: 'Created', width: 200, align: 'right'},
          {key: 'creator', label: 'Created By', width: 200, align: 'right'},
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
