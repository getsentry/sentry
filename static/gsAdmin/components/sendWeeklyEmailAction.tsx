import {Component} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import TextField from 'sentry/components/forms/fields/textField';
import withApi from 'sentry/utils/withApi';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';

type Props = {api: Client; orgId: string} & AdminConfirmRenderProps;

type State = {
  deliveryEmail: string;
  dryRun: boolean;
  targetEmail: string;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class SendWeeklyEmailAction extends Component<Props, State> {
  state: State = {
    dryRun: true,
    targetEmail: '',
    deliveryEmail: '',
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
  }

  handleConfirm = (_params: AdminConfirmParams) => {
    const {targetEmail, deliveryEmail, dryRun} = this.state;

    addLoadingMessage('Sending Email');
    this.props.api
      .requestPromise(`/customers/${this.props.orgId}/send-weekly-email/`, {
        method: 'POST',
        data: {targetEmail, deliveryEmail, dryRun},
      })
      .then(() => {
        addSuccessMessage('Email queued');
      })
      .catch(res => {
        if (res.status === 404) {
          addErrorMessage('User is not a member of the organization!');
        } else {
          addErrorMessage(res.responseText || res.name);
        }
      });
  };

  render() {
    return (
      <div>
        <TextField
          autoFocus
          inline={false}
          stacked
          flexibleControlStateSize
          label="Target User Email"
          help="The weekly email will be generated based on this user. If left empty the email will be generated for a user with access to all projects"
          name="username"
          inputMode="text"
          value={this.state.targetEmail}
          onChange={(targetEmail: any) => this.setState({targetEmail})}
        />
        <TextField
          autoFocus
          inline={false}
          stacked
          flexibleControlStateSize
          label="Delivery email address"
          help="The weekly email will be sent to this address."
          required
          name="username"
          inputMode="text"
          value={this.state.deliveryEmail}
          onChange={(deliveryEmail: any) => this.setState({deliveryEmail})}
        />
        <BooleanField
          label="Dry Run"
          inline={false}
          name="dryrun"
          stacked
          value={this.state.dryRun}
          onChange={(dryRun: any) => this.setState({dryRun})}
        />
      </div>
    );
  }
}

export default withApi(SendWeeklyEmailAction);
