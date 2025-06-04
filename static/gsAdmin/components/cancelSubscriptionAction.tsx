import {Component, Fragment} from 'react';
import moment from 'moment-timezone';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
};

type State = {
  applyBalance: boolean;
  cancelAtPeriodEnd: boolean;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class CancelSubscriptionAction extends Component<Props, State> {
  state: State = {
    cancelAtPeriodEnd: true,
    applyBalance: true,
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
  }

  handleConfirm = (params: AdminConfirmParams) => {
    const {applyBalance, cancelAtPeriodEnd} = this.state;
    this.props.onConfirm?.({cancelAtPeriodEnd, applyBalance, ...params});
  };

  render() {
    const {subscription} = this.props;
    const options: Array<[boolean, string, string]> = [
      [false, 'Immediately', 'End the subscription immediately.'],
      [
        true,
        `At period end (${moment(subscription.contractPeriodEnd).format('ll')})`,
        'End the subscription at the end of the current contract period.',
      ],
    ];
    return (
      <Fragment>
        {options.map(([enabled, label, help]) => (
          <div key={enabled.toString()}>
            <label
              style={{marginBottom: 10, position: 'relative'}}
              key="cancelAtPeriodEnd"
              aria-label={label}
            >
              <div style={{position: 'absolute', left: 0, width: 20}}>
                <input
                  type="radio"
                  name="cancelAtPeriodEnd"
                  checked={this.state.cancelAtPeriodEnd === enabled}
                  onChange={() => this.setState({cancelAtPeriodEnd: enabled})}
                />
              </div>
              <div style={{marginLeft: 25}}>
                <strong>{label}</strong>
                <br />
                <small style={{fontWeight: 'normal'}}>{help}</small>
              </div>
            </label>
            {enabled ? null : (
              <label
                style={{
                  marginBottom: 10,
                  marginLeft: 25,
                  position: 'relative',
                }}
                key="credit"
              >
                <input
                  type="checkbox"
                  name="applyBalance"
                  checked={this.state.applyBalance}
                  style={{marginRight: 5}}
                  onChange={e => this.setState({applyBalance: e.target.checked})}
                  disabled={this.state.cancelAtPeriodEnd !== enabled}
                />
                Apply credit for the remaining time on their subscription.
              </label>
            )}
          </div>
        ))}
      </Fragment>
    );
  }
}

export default CancelSubscriptionAction;
