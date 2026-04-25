import {Component, Fragment} from 'react';
import moment from 'moment-timezone';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {withApi} from 'sentry/utils/withApi';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = {
  api: Client;
  orgId: string;
  subscription: Subscription;
} & AdminConfirmRenderProps;

type State = {
  addSeerTrial: boolean;
  applyImmediately: boolean;
};

/**
 * Rendered as part of an openAdminConfirmModal call.
 * Runs the MigrateLegacySeer job logic for a single organization.
 */
class MigrateLegacySeerAction extends Component<Props, State> {
  state: State = {
    applyImmediately: true,
    addSeerTrial: true,
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
  }

  handleConfirm = (_params: AdminConfirmParams) => {
    const {applyImmediately, addSeerTrial} = this.state;

    addLoadingMessage('Running legacy Seer migration\u2026');
    this.props.api
      .requestPromise(`/customers/${this.props.orgId}/migrate-legacy-seer/`, {
        method: 'POST',
        data: {applyImmediately, addSeerTrial},
      })
      .then(() => {
        addSuccessMessage('Legacy Seer migration complete.');
      })
      .catch(res => {
        addErrorMessage(
          res.responseJSON?.detail ?? res.responseText ?? 'Migration failed.'
        );
      });
  };

  render() {
    const {subscription} = this.props;
    const {applyImmediately, addSeerTrial} = this.state;
    const periodEnd = moment(subscription.onDemandPeriodEnd).format('ll');

    const timingOptions: Array<[boolean, string, string]> = [
      [true, 'Immediately', 'Remove legacy Seer from the subscription right now.'],
      [
        false,
        `At period end (${periodEnd})`,
        'Stage the removal to apply at the start of the next billing period.',
      ],
    ];

    return (
      <Fragment>
        <p>
          This will remove legacy Seer reserved budgets and optionally schedule a 14-day
          Seer seat trial starting at the next billing period.
        </p>

        {timingOptions.map(([value, label, help]) => (
          <div key={String(value)}>
            <label style={{marginBottom: 10, position: 'relative'}}>
              <div style={{position: 'absolute', left: 0, width: 20}}>
                <input
                  type="radio"
                  name="applyImmediately"
                  checked={applyImmediately === value}
                  onChange={() => this.setState({applyImmediately: value})}
                />
              </div>
              <div style={{marginLeft: 25}}>
                <strong>{label}</strong>
                <br />
                <small style={{fontWeight: 'normal'}}>{help}</small>
              </div>
            </label>
          </div>
        ))}

        <label style={{marginBottom: 10, marginTop: 10, display: 'block'}}>
          <input
            type="checkbox"
            name="addSeerTrial"
            checked={addSeerTrial}
            style={{marginRight: 5}}
            onChange={e => this.setState({addSeerTrial: e.target.checked})}
          />
          <strong>Add 14-day Seer seat trial</strong> at the next billing period.
        </label>
      </Fragment>
    );
  }
}

export default withApi(MigrateLegacySeerAction);
