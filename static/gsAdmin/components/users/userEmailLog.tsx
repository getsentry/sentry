import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ResultTable} from 'sentry/components/resultTable';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {SelectableContainerPanel} from 'admin/components/selectableContainer';

type Props = {
  Panel: SelectableContainerPanel;
  user: User;
};

type EmailActivity = {
  created: number;
  email: string;
  event: string;
};

export function UserEmailLog({user, Panel}: Props) {
  const [activeEmail, setActiveEmail] = useState(user.email);
  const [removedBounces, setRemovedBounces] = useState<string[]>([]);
  const {data, isPending, isError} = useQuery(
    apiOptions.as<{activity: EmailActivity[]}>()(
      '/_admin/users/$userId/email-activity/',
      {
        path: {userId: user.id},
        query: {email: activeEmail},
        staleTime: 0,
      }
    )
  );
  const removeBounce = useMutation({
    mutationFn: (email: string) =>
      fetchMutation({
        method: 'DELETE',
        options: {query: {email}},
        url: getApiUrl('/_admin/users/$userId/email-bounces/', {
          path: {userId: user.id},
        }),
      }),
    onSuccess: (_, email) => {
      setRemovedBounces(emails => [...emails, email]);
      addSuccessMessage('Bounce removed');
    },
    onError: () => addErrorMessage('Unable to remove bounce'),
  });

  const activity = data?.activity ?? [];
  const emailSelector = (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix="Results for" size="xs" />
      )}
      value={activeEmail}
      options={user.emails.map(e => ({value: e.email, label: e.email}))}
      onChange={opt => setActiveEmail(opt.value)}
    />
  );

  return (
    <Panel extraActions={emailSelector}>
      <ResultTable>
        <thead>
          <tr>
            <th>Status</th>
            <th>Email</th>
            <th>Date</th>
            <th style={{width: 150, textAlign: 'right'}}>Time</th>
          </tr>
        </thead>
        <tbody>
          {isPending ? (
            <tr>
              <td colSpan={4}>
                <LoadingIndicator />
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={4}>
                <Alert.Container>
                  <Alert variant="danger" showIcon={false}>
                    There was a problem loading SendGrid details
                  </Alert>
                </Alert.Container>
              </td>
            </tr>
          ) : activity.length === 0 ? (
            <tr>
              <td colSpan={4}>No results found</td>
            </tr>
          ) : (
            activity.map((entry, index) => {
              const date = new Date(entry.created * 1000);
              return (
                <tr key={index}>
                  <td>{entry.event}</td>
                  <td data-label="Email">
                    {entry.email}
                    {entry.event === 'bounce' &&
                      !removedBounces.includes(entry.email) && (
                        <Button
                          variant="danger"
                          disabled={removeBounce.isPending}
                          onClick={() => removeBounce.mutate(entry.email)}
                        >
                          remove bounce
                        </Button>
                      )}
                  </td>
                  <td data-label="Date">{date.toDateString()}</td>
                  <td data-label="Time" style={{textAlign: 'right'}}>
                    {date.toLocaleTimeString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </ResultTable>
    </Panel>
  );
}
