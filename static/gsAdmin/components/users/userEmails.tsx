import type {User} from 'sentry/types/user';

import ResultTable from 'admin/components/resultTable';
import type {SelectableContainerPanel} from 'admin/components/selectableContainer';

type Props = {
  Panel: SelectableContainerPanel;
  user: User;
};

function UserEmails({Panel, user}: Props) {
  const primary = user.email;
  const emails = user.emails ? user.emails : [{email: primary}];

  return (
    <Panel>
      <ResultTable>
        <thead>
          <tr>
            <th>Email</th>
            <th style={{width: 150}}>Status</th>
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
            </tr>
          ))}
        </tbody>
      </ResultTable>
    </Panel>
  );
}

export default UserEmails;
