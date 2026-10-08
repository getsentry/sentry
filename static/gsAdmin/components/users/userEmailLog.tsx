import {useCallback, useEffect, useState} from 'react';

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

export function UserEmailLog({user, Panel}: Props) {
  const [loading, setLoading] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [activeEmail, setActiveEmail] = useState(user.email);
  const [results, setResults] = useState<any[]>([]);
  const [hideButton, setHideButton] = useState(false);

  const fetchEmails = useCallback(async () => {
    const apiKey = ConfigStore.get('getsentry.sendgridApiKey');
    const path = `https://api.sendgrid.com/v3/email_activity?limit=25&email=${encodeURIComponent(
      activeEmail
    )}`;
    setLoading(true);

    try {
      // TODO(dcramer): this doesnt cancel when a new request is made
      const resp = await fetch(path, {headers: {Authorization: `Bearer ${apiKey}`}});

      if (resp.ok) {
        setError(false);
        setResults(await resp.json());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }

    setLoading(false);
  }, [activeEmail]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const removeBounce = async (email: string) => {
    const apiKey = ConfigStore.get('getsentry.sendgridApiKey');
    const path = `https://api.sendgrid.com/v3/suppression/bounces/${encodeURIComponent(
      email
    )}`;

    try {
      const resp = await fetch(path, {
        method: 'DELETE',
        headers: {Authorization: `Bearer ${apiKey}`},
      });

      if (resp.ok) {
        // eslint-disable-next-line no-alert
        alert('success');
        setHideButton(true);
      } else {
        // eslint-disable-next-line no-alert
        alert(await resp.text());
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert('fetch failed');
    }
  };

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
          {loading ? (
            <tr>
              <td colSpan={4}>
                <LoadingIndicator />
              </td>
            </tr>
          ) : error ? (
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
}
