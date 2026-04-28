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
 * Posts to the CustomerMigrateLegacySeerAdminEndpoint to migrate a single
 * organization off legacy Seer reserved budgets.
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
      [
        true,
        'Immediately',
        `Remove legacy Seer from the subscription right now. The current billing period end (${periodEnd}) is unchanged — the org will simply be invoiced at that date without the legacy Seer line item.`,
      ],
      [
        false,
        `At period end (${periodEnd})`,
        'Stage the removal to apply at the start of the next billing period.',
      ],
    ];

    return (
      <Fragment>
        <p>
          Migrate a user off Legacy Seer to allow them to use the seat-based Seer plan.
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

        <label style={{marginBottom: 4, marginTop: 10, display: 'block'}}>
          <input
            type="checkbox"
            name="addSeerTrial"
            checked={addSeerTrial}
            style={{marginRight: 5}}
            onChange={e => this.setState({addSeerTrial: e.target.checked})}
          />
          <strong>Add 14-day Seer seat trial</strong>{' '}
          {applyImmediately
            ? 'starting immediately'
            : `starting at the next billing period (${periodEnd})`}
          .
        </label>
        <p style={{marginTop: 20}}>
          After migration, users opt in to Seer from their organization settings. Share
          this link with the customer:{' '}
          <a
            href="https://docs.sentry.io/product/ai-in-sentry/seer/#getting-started-with-seer"
            target="_blank"
            rel="noreferrer"
          >
            Getting Started with Seer
          </a>
          .
        </p>
      </Fragment>
    );
  }
}

export default withApi(MigrateLegacySeerAction);
