import {Component} from 'react';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';

const suspendReasons = [
  ['event_volume', 'Event Volume', 'This account has greatly exceeded its paid volume'],
  ['fraud', 'Fraudulent', 'This account was reported as fraudulent'],
] as const;

type State = {
  suspensionReason: (typeof suspendReasons)[number][0] | null;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class SuspendAccountAction extends Component<AdminConfirmRenderProps, State> {
  state: State = {
    suspensionReason: null,
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
  }

  handleConfirm = (_params: AdminConfirmParams) => {
    // XXX(epurkhiser): In the original implementation none of the audit params
    // were passed, is that an oversight?
    this.props.onConfirm?.({suspensionReason: this.state.suspensionReason});
  };

  getReasonChoices = () => [
    ['event_volume', 'Event Volume', 'This account has greatly exceeded its paid volume'],
    ['fraud', 'Fraudulent', 'This account was reported as fraudulent'],
  ];

  render() {
    return suspendReasons.map(([key, label, help]) => (
      <label style={{marginBottom: 10, position: 'relative'}} key={key}>
        <div style={{position: 'absolute', left: 0, width: 20}}>
          <input
            data-test-id={`suspend-radio-btn-${key}`}
            aria-label={label}
            type="radio"
            name="suspensionReason"
            value={key}
            checked={this.state.suspensionReason === key}
            onChange={() => {
              this.setState({suspensionReason: key});
              this.props.disableConfirmButton(false);
            }}
          />
        </div>
        <div style={{marginLeft: 25}}>
          <strong>{label}</strong>
          <br />
          <small style={{fontWeight: 'normal'}}>{help}</small>
        </div>
      </label>
    ));
  }
}

export default SuspendAccountAction;
