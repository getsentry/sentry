import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';

import AdminConfirmationModal from 'admin/components/adminConfirmationModal';
import ResultGrid from 'admin/components/resultGrid';

type Props = {
  onRemoveEmail: (hash: string) => void;
  orgId: string;
  projectId: string;
};

function EventUsers({orgId, projectId, onRemoveEmail}: Props) {
  const getRow = (row: any) => {
    if (row.identifier === null) {
      return [];
    }

    return [
      <td key="email">{row.email}</td>,
      <td key="id" style={{textAlign: 'center'}}>
        {row.identifier}
      </td>,
      <td key="hash" style={{textAlign: 'center'}}>
        {row.hash}
      </td>,
      <td key="actions" style={{textAlign: 'center'}}>
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
          showAuditFields
        >
          <Button size="xs" redesign priority="danger">
            Delete Email
          </Button>
        </AdminConfirmationModal>
      </td>,
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
        <th key="email">Email</th>,
        <th key="id" style={{width: 150, textAlign: 'center'}}>
          ID
        </th>,
        <th key="hash" style={{width: 150, textAlign: 'center'}}>
          User Hash
        </th>,
        <th key="actions" style={{width: 150, textAlign: 'center'}}>
          Delete Email
        </th>,
      ]}
      columnsForRow={getRow}
    />
  );
}

export default EventUsers;
