import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Truncate from 'sentry/components/truncate';
import {IconEdit} from 'sentry/icons';
import ConfigStore from 'sentry/stores/configStore';

import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';
import UserPermissionsModal from 'admin/components/users/userPermissionsModal';

export default function SentryEmployees() {
  const gridColumns = [
    <th key="user">User</th>,
    <th key="email" style={{width: 100, textAlign: 'center'}}>
      Email
    </th>,
    <th key="isActive" style={{width: 100, textAlign: 'center'}}>
      Active
    </th>,
    <th key="isStaff" style={{width: 100, textAlign: 'center'}}>
      Staff
    </th>,
    <th key="isSuperuserRead" style={{width: 100, textAlign: 'center'}}>
      Superuser Read
    </th>,
    <th key="isSuperuserWrite" style={{width: 100, textAlign: 'center'}}>
      Superuser Write
    </th>,
    <th key="permissions" style={{width: 200, textAlign: 'center'}}>
      Permissions
    </th>,
  ];
  if (ConfigStore.get('user').permissions.has('users.admin')) {
    gridColumns.push(
      <th key="assignPermissions" style={{width: 100, textAlign: 'center'}}>
        Edit Permissions
      </th>
    );
  }

  const getRow = (row: any) => {
    const userRow = [
      <td key="user">
        <Link to={`/_admin/users/${row.id}/`}>
          <UserBadge
            hideEmail
            user={row}
            displayName={<Truncate maxLength={40} value={row.name} />}
          />
        </Link>
      </td>,
      <td key="email" style={{textAlign: 'center'}}>
        {row.email}
      </td>,
      <td key="isActive" style={{textAlign: 'center'}}>
        {row.isActive ? 'True' : 'False'}
      </td>,
      <td key="isStaff" style={{textAlign: 'center'}}>
        {row.isStaff ? 'True' : 'False'}
      </td>,
      <td key="isSuperuserRead" style={{textAlign: 'center'}}>
        {row.isSuperuser ? 'True' : 'False'}
      </td>,
      <td key="isSuperuserWrite" style={{textAlign: 'center'}}>
        {row.permissions.includes('superuser.write') ? 'True' : 'False'}
      </td>,
      <td key="permissions" style={{textAlign: 'center'}}>
        {row.permissions.map((perm: any, i: any) => {
          if (row.permissions.length > 1 && i < row.permissions.length - 1) {
            return perm + ', ';
          }
          return perm;
        })}
      </td>,
    ];
    if (ConfigStore.get('user').permissions.has('users.admin')) {
      userRow.push(
        <td key="assignPermissions" style={{textAlign: 'center'}}>
          <Button
            aria-label="Edit Permissions"
            onClick={() => {
              openModal(deps => (
                <UserPermissionsModal
                  {...deps}
                  user={row}
                  onSubmit={() => {
                    // TODO: ideally this would update the user instead of refresh the page
                    window.location.reload();
                  }}
                />
              ));
            }}
            size="sm"
            icon={<IconEdit size="xs" />}
          />
        </td>
      );
    }
    return userRow;
  };

  return (
    <div>
      <PageHeader title="Sentry Employees" />
      <ResultGrid
        inPanel
        path="/_admin/employees/"
        endpoint="/employees/"
        method="GET"
        columns={gridColumns}
        columnsForRow={getRow}
        hasSearch
        hasPagination
        filters={{
          active: {
            name: 'Active',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          isEmployee: {
            name: 'Employee',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          staff: {
            name: 'Staff',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          superuserRead: {
            name: 'Superuser Read',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          superuserWrite: {
            name: 'Superuser Write',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          billingAdmin: {
            name: 'billing.admin',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          billingProvision: {
            name: 'billing.provision',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          broadcastsAdmin: {
            name: 'broadcasts.admin',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          relocationAdmin: {
            name: 'relocation.admin',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          usersAdmin: {
            name: 'users.admin',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
          optionsAdmin: {
            name: 'options.admin',
            options: [
              ['true', 'True'],
              ['false', 'False'],
            ],
          },
        }}
        sortOptions={[['name', 'Name']]}
        defaultSort="user"
      />
    </div>
  );
}
