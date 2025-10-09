import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {IconDelete} from 'sentry/icons';
import type {User} from 'sentry/types/user';
import useApi from 'sentry/utils/useApi';

import ResultTable from 'admin/components/resultTable';
import type {SelectableContainerPanel} from 'admin/components/selectableContainer';

type Props = {
  Panel: SelectableContainerPanel;
  user: User;
  onUserUpdate?: () => void;
};

function UserEmails({Panel, user, onUserUpdate: onEmailRemoved}: Props) {
  const api = useApi();
  const primary = user.email;
  const emails = user.emails ? user.emails : [{email: primary}];

  const handleRemoveEmail = async (email: string) => {
    try {
      await api.requestPromise(`/users/${user.id}/emails/`, {
        method: 'DELETE',
        data: {email},
      });
      addSuccessMessage(`Email ${email} has been removed.`);
      onEmailRemoved?.();
    } catch (error) {
      addErrorMessage(
        error?.responseJSON?.detail || 'Failed to remove email. Please try again.'
      );
    }
  };

  return (
    <Panel>
      <ResultTable>
        <thead>
          <tr>
            <th>Email</th>
            <th style={{width: 150}}>Status</th>
            <th style={{width: 100}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((data, idx) => (
            <tr key={idx}>
              <td>
                <strong>{data.email}</strong>
                {data.email === primary && <small> — primary </small>}
              </td>
              <td>
                {
                  // @ts-expect-error TS(2339): Property 'is_verified' does not exist on type '{ e... Remove this comment to see the full error message
                  data.is_verified ? 'Verified' : 'Unverified'
                }
              </td>
              <td>
                {data.email !== primary && (
                  <Confirm
                    message={`Are you sure you want to remove the email ${data.email}?`}
                    onConfirm={() => handleRemoveEmail(data.email)}
                    priority="danger"
                  >
                    <Button
                      data-test-id="remove-email-button"
                      priority="danger"
                      size="xs"
                      icon={<IconDelete size="xs" />}
                      aria-label={'Remove email'}
                    >
                      {'Remove'}
                    </Button>
                  </Confirm>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </ResultTable>
    </Panel>
  );
}

export default UserEmails;
