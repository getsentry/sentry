import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {IconMail} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import ResultGrid from 'admin/components/resultGrid';

type Props = {
  orgId: string;
};

const getRow = (row: any) => [
  <td key="name">
    <UserName>
      <UserAvatar user={row} size={18} />
      <LinkButton
        external
        priority="link"
        href={`mailto:${row.email}`}
        icon={<IconMail size="xs" />}
        title="Send email"
        aria-label="Send email"
      />
      {row.user ? (
        <Link to={`/_admin/users/${row.user.id}/`}>{row.email}</Link>
      ) : (
        <span>{row.email}</span>
      )}
      {row.pending && <Tag variant="warning">Invite Pending</Tag>}
    </UserName>
  </td>,
  <td key="role" style={{textAlign: 'center'}}>
    {row.roleName}
  </td>,
  <td key="lastLogin" style={{textAlign: 'right'}}>
    {row.user ? moment(row.user.lastLogin).fromNow() : null}
  </td>,
  <td key="lastActive" style={{textAlign: 'right'}}>
    {row.user?.lastActive ? moment(row.user.lastActive).fromNow() : null}
  </td>,
  <td key="created" style={{textAlign: 'right'}}>
    {moment(row.dateCreated).fromNow()}
  </td>,
];

function CustomerMembers({orgId}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Members"
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/organizations/${orgId}/members/`}
      method="GET"
      defaultParams={{per_page: 10}}
      hasSearch
      columns={[
        <th key="name">Member</th>,
        <th key="role" style={{width: 150, textAlign: 'center'}}>
          Role
        </th>,
        <th key="lastLogin" style={{width: 150, textAlign: 'right'}}>
          Last Login
        </th>,
        <th key="lastActive" style={{width: 150, textAlign: 'right'}}>
          Last Active
        </th>,
        <th key="created" style={{width: 150, textAlign: 'right'}}>
          Created
        </th>,
      ]}
      columnsForRow={getRow}
    />
  );
}

const UserName = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

export default CustomerMembers;
