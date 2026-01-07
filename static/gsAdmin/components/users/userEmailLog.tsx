import {Component} from 'react';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';

import ResultTable from 'admin/components/resultTable';
import type {SelectableContainerPanel} from 'admin/components/selectableContainer';

type Props = {
  /**
   * This component needs to render some additional actions within the
   * SelectableContainer panel, so it must be injected as a property.
   */
  Panel: SelectableContainerPanel;
  user: User;
};

type State = {
  activeEmail: string;
  error: boolean;
  hideButton: boolean;
  loading: boolean | null;
  results: any[];
};

export default class UserEmailLog extends Component<Props, State> {
  state: State = {
    loading: null,
    error: false,
    activeEmail: this.props.user.email,
    results: [],
    hideButton: false,
  };

  componentDidMount() {
    this.fetchEmails();
  }

  fetchEmails = async () => {
    const {activeEmail} = this.state;
    const apiKey = ConfigStore.get('getsentry.sendgridApiKey');
    const path = `https://api.sendgrid.com/v3/email_activity?limit=25&email=${encodeURIComponent(
      activeEmail
    )}`;
    this.setState({loading: true});

    try {
      // TODO(dcramer): this doesnt cancel when a new request is made
      const resp = await fetch(path, {headers: {Authorization: `Bearer ${apiKey}`}});

      if (resp.ok) {
        this.setState({error: false, results: await resp.json()});
      } else {
        this.setState({error: true});
      }
    } catch {
      this.setState({error: true});
    }

    this.setState({loading: false});
  };

  removeBounce = async (email: string) => {
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
        this.setState({hideButton: true});
      } else {
        // eslint-disable-next-line no-alert
        alert(await resp.text());
      }
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert('fetch failed');
    }
  };

  changeActiveEmail = (email: string) => this.setState({activeEmail: email});

  renderNoResults = () => (
    <tr>
      <td colSpan={4}>No results found</td>
    </tr>
  );

  renderResults = () =>
    this.state.results.map((data, idx) => {
      const date = new Date(data.created * 1000);
      return (
        <tr key={idx}>
          <td>{data.event}</td>
          <td>
            {data.email}
            {data.event === 'bounce' && !this.state.hideButton && (
              <Button
                priority="danger"
                onClick={this.removeBounce.bind(this, data.email)}
              >
                remove bounce
              </Button>
            )}
          </td>
          <td>{date.toDateString()}</td>
          <td style={{textAlign: 'right'}}>{date.toLocaleTimeString()}</td>
        </tr>
      );
    });

  render() {
    const {user, Panel} = this.props;
    const {activeEmail} = this.state;

    const emailSelector = (
      <CompactSelect
        trigger={triggerProps => (
          <SelectTrigger.Button {...triggerProps} prefix="Results for" size="xs" />
        )}
        value={activeEmail}
        options={user.emails.map(e => ({value: e.email, label: e.email}))}
        onChange={opt => this.changeActiveEmail(opt.value)}
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
            {this.state.loading ? (
              <tr>
                <td colSpan={4}>
                  <LoadingIndicator />
                </td>
              </tr>
            ) : this.state.error ? (
              <tr>
                <td colSpan={4}>
                  <Alert.Container>
                    <Alert variant="danger" showIcon={false}>
                      There was a problem loading SendGrid details
                    </Alert>
                  </Alert.Container>
                </td>
              </tr>
            ) : this.state.results.length === 0 ? (
              this.renderNoResults()
            ) : (
              this.renderResults()
            )}
          </tbody>
        </ResultTable>
      </Panel>
    );
  }
}
