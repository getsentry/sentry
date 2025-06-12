import {Component, Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import NumberField from 'sentry/components/forms/fields/numberField';
import TextareaField from 'sentry/components/forms/fields/textareaField';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
};

type State = {
  creditAmount?: number;
  notes?: string;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class StartupsAction extends Component<Props, State> {
  state: State = {
    creditAmount: 500, // Default $500 credit
    notes: '',
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
    this.props.disableConfirmButton(false);
  }

  handleCreditAmountChange = (value: number) => {
    this.setState({creditAmount: value});
  };

  handleNotesChange = (value: string) => {
    this.setState({notes: value});
  };

  handleConfirm = (_params: AdminConfirmParams) => {
    const {creditAmount, notes} = this.state;
    const {onConfirm} = this.props;

    const data = {
      startupsProgram: true,
      creditAmount: (creditAmount || 0) * 100, // Convert to cents
      notes,
    };
    onConfirm?.(data);
  };

  render() {
    const {subscription} = this.props;
    const {creditAmount, notes} = this.state;

    if (!subscription) {
      return null;
    }

    return (
      <Fragment>
        <Alert.Container>
          <Alert type="info" showIcon>
            This will grant the customer access to the startups program, add the specified credit amount, and send them a welcome email.
          </Alert>
        </Alert.Container>

        <NumberField
          required
          inline={false}
          stacked
          flexibleControlStateSize
          label="Credit Amount (USD)"
          name="creditAmount"
          value={creditAmount}
          onChange={this.handleCreditAmountChange}
          help="Amount of credit to grant to this customer (in USD)"
          min={0}
          max={10000}
        />

        <TextareaField
          inline={false}
          stacked
          flexibleControlStateSize
          label="Notes"
          name="notes"
          value={notes}
          onChange={this.handleNotesChange}
          help="Optional notes about this startups program enrollment"
          placeholder="Notes about why this customer was granted access to the startups program..."
        />
      </Fragment>
    );
  }
}

export default StartupsAction;
