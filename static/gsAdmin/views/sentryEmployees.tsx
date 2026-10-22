import {IconEdit} from '@sentry/icons/edit';

import {Button} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {ResultGrid, type ResultGridColumn} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {Truncate} from 'sentry/components/truncate';
import {ConfigStore} from 'sentry/stores/configStore';

import {PageHeader} from 'admin/components/pageHeader';
import {UserPermissionsModal} from 'admin/components/users/userPermissionsModal';

export function SentryEmployees() {
  const {openModal} = useModal();

  const gridColumns: ResultGridColumn[] = [
    {key: 'user', label: 'User'},
    {key: 'email', label: 'Email', width: 100, align: 'center'},
    {key: 'isActive', label: 'Active', width: 100, align: 'center'},
    {key: 'isStaff', label: 'Staff', width: 100, align: 'center'},
    {key: 'isSuperuserRead', label: 'Superuser Read', width: 100, align: 'center'},
    {key: 'isSuperuserWrite', label: 'Superuser Write', width: 100, align: 'center'},
    {key: 'permissions', label: 'Permissions', width: 200, align: 'center'},
  ];
  if (ConfigStore.get('user').permissions.has('users.admin')) {
    gridColumns.push({
      key: 'assignPermissions',
      label: 'Edit Permissions',
      width: 100,
      align: 'center',
    });
  }

  const getRow = (row: any) => {
    const userRow = [
      <SimpleTable.RowCell key="user" overflow="visible">
        <Link to={`/_admin/users/${row.id}/`}>
          <UserBadge
            hideEmail
            user={row}
            displayName={<Truncate maxLength={40} value={row.name} />}
          />
        </Link>
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="email" justify="center">
        {row.email}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="isActive" justify="center">
        {row.isActive ? 'True' : 'False'}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="isStaff" justify="center">
        {row.isStaff ? 'True' : 'False'}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="isSuperuserRead" justify="center">
        {row.isSuperuser ? 'True' : 'False'}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="isSuperuserWrite" justify="center">
        {row.permissions.includes('superuser.write') ? 'True' : 'False'}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="permissions" justify="center">
        <Text align="center">
          {row.permissions.map((perm: any, i: any) => {
            if (row.permissions.length > 1 && i < row.permissions.length - 1) {
              return perm + ', ';
            }
            return perm;
          })}
        </Text>
      </SimpleTable.RowCell>,
    ];
    if (ConfigStore.get('user').permissions.has('users.admin')) {
      userRow.push(
        <SimpleTable.RowCell key="assignPermissions" justify="center">
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
        </SimpleTable.RowCell>
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
        columns={gridColumns}
        columnsForRow={getRow}
        hasSearch
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
