import {IconMail} from '@sentry/icons/mail';
import moment from 'moment-timezone';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Props = {
  orgId: string;
};

const getRow = (row: any) => [
  <SimpleTable.RowCell key="name">
    <Flex align="center" gap="md">
      <UserAvatar user={row} size={18} />
      <LinkButton
        external
        variant="link"
        href={`mailto:${row.email}`}
        icon={<IconMail size="xs" />}
        tooltipProps={{title: 'Send email'}}
        aria-label="Send email"
      />
      {row.user ? (
        <Link to={`/_admin/users/${row.user.id}/`}>{row.email}</Link>
      ) : (
        <span>{row.email}</span>
      )}
      {row.pending && <Tag variant="warning">Invite Pending</Tag>}
    </Flex>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="role" justify="center">
    {row.roleName}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="lastLogin" justify="end">
    {row.user ? moment(row.user.lastLogin).fromNow() : null}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="lastActive" justify="end">
    {row.user?.lastActive ? moment(row.user.lastActive).fromNow() : null}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="created" justify="end">
    {moment(row.dateCreated).fromNow()}
  </SimpleTable.RowCell>,
];

export function CustomerMembers({orgId}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Members"
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/organizations/${orgId}/members/`}
      defaultParams={{per_page: 10}}
      hasSearch
      columns={[
        {key: 'name', label: 'Member'},
        {key: 'role', label: 'Role', width: 150, align: 'center'},
        {key: 'lastLogin', label: 'Last Login', width: 150, align: 'right'},
        {key: 'lastActive', label: 'Last Active', width: 150, align: 'right'},
        {key: 'created', label: 'Created', width: 150, align: 'right'},
      ]}
      columnsForRow={getRow}
    />
  );
}
