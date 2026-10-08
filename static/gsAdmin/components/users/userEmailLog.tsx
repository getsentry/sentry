import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ResultTable} from 'sentry/components/resultTable';
import {ConfigStore} from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';

import type {SelectableContainerPanel} from 'admin/components/selectableContainer';

type Props = {
  /**
   * This component needs to render some additional actions within the
   * SelectableContainer panel, so it must be injected as a property.
   */
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
  const [hideButton, setHideButton] = useState(false);

  // SendGrid is an external API, so it can't go through apiOptions and the Sentry API client
  const {
    data: results = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ['sendgrid-email-activity', activeEmail],
    queryFn: async ({signal}): Promise<EmailActivity[]> => {
      const apiKey = ConfigStore.get('getsentry.sendgridApiKey');
      const resp = await fetch(
        `https://api.sendgrid.com/v3/email_activity?limit=25&email=${encodeURIComponent(activeEmail)}`,
        {headers: {Authorization: `Bearer ${apiKey}`}, signal}
      );
      if (!resp.ok) {
        throw new Error(`SendGrid responded with ${resp.status}`);
      }
      return resp.json();
    },
    staleTime: 0,
    retry: false,
  });

  const {mutate: removeBounce} = useMutation({
    mutationFn: async (email: string) => {
      const apiKey = ConfigStore.get('getsentry.sendgridApiKey');
      const resp = await fetch(
        `https://api.sendgrid.com/v3/suppression/bounces/${encodeURIComponent(email)}`,
        {method: 'DELETE', headers: {Authorization: `Bearer ${apiKey}`}}
      );
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
    },
    onSuccess: () => {
      // eslint-disable-next-line no-alert
      alert('success');
      setHideButton(true);
    },
    onError: error => {
      // fetch() rejects with a TypeError on network failure; anything else is SendGrid's error body
      // eslint-disable-next-line no-alert
      alert(error instanceof TypeError ? 'fetch failed' : error.message);
    },
  });

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
          ) : results.length === 0 ? (
            <tr>
              <td colSpan={4}>No results found</td>
            </tr>
          ) : (
            results.map((data, idx) => {
              const date = new Date(data.created * 1000);
              return (
                <tr key={idx}>
                  <td>{data.event}</td>
                  <td data-label="Email">
                    {data.email}
                    {data.event === 'bounce' && !hideButton && (
                      <Button variant="danger" onClick={() => removeBounce(data.email)}>
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
