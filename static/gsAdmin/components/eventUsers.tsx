import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {AdminConfirmationModal} from 'admin/components/adminConfirmationModal';

type Props = {
  onRemoveEmail: (hash: string) => void;
  orgId: string;
  projectId: string;
};

export function EventUsers({orgId, projectId, onRemoveEmail}: Props) {
  const getRow = (row: any) => {
    if (row.identifier === null) {
      return [];
    }

    return [
      <SimpleTable.RowCell key="email">{row.email}</SimpleTable.RowCell>,
      <SimpleTable.RowCell key="id" justify="center">
        {row.identifier}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="hash" justify="center">
        {row.hash}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="actions" justify="center">
        <AdminConfirmationModal
          header={<h4>{'Remove Event User'}</h4>}
          modalSpecificContent={
            <Fragment>
              <p>
                <strong>
                  You're removing this user from events of the <code>{projectId}</code>{' '}
                  project:
                </strong>
              </p>
              <p>
                <strong>Email:</strong> {row.email}
                <br />
                <strong>ID:</strong> {row.identifier}
                <br />
                <strong>User Hash:</strong> {row.hash}
              </p>
            </Fragment>
          }
          onConfirm={() => onRemoveEmail(row.hash)}
        >
          <Button size="xs" variant="danger">
            Delete Email
          </Button>
        </AdminConfirmationModal>
      </SimpleTable.RowCell>,
    ];
  };

  return (
    <ResultGrid
      inPanel
      path={`/_admin/customers/${orgId}/projects/${projectId}/`}
      endpoint={`/projects/${orgId}/${projectId}/users/`}
      hasSearch
      defaultParams={{per_page: 10}}
      columns={[
        {key: 'email', label: 'Email'},
        {key: 'id', label: 'ID', width: 150, align: 'center'},
        {key: 'hash', label: 'User Hash', width: 150, align: 'center'},
        {key: 'actions', label: 'Delete Email', width: 150, align: 'center'},
      ]}
      columnsForRow={getRow}
    />
  );
}
