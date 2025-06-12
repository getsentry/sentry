import {Component, Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import SelectField from 'sentry/components/forms/fields/selectField';
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
  notes?: string;
  programType?: string | null;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class StartupsAction extends Component<Props, State> {
  state: State = {
    programType: 'ycombinator', // Default to YCombinator
    notes: '',
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
    this.props.disableConfirmButton(false);
  }

  handleProgramTypeChange = (value: string | null) => {
    this.setState({programType: value});
  };

  handleNotesChange = (value: string) => {
    this.setState({notes: value});
  };

  handleConfirm = (_params: AdminConfirmParams) => {
    const {programType, notes} = this.state;
    const {onConfirm} = this.props;

    const data = {
      startupsProgram: true,
      programType,
      notes,
    };
    onConfirm?.(data);
  };

  getProgramDescription = (programType: string | null) => {
    switch (programType) {
      case 'ycombinator':
        return '$50,000 in credits for YCombinator startups';
      case 'other':
        return '$5,000 in credits for qualifying startups';
      default:
        return '';
    }
  };

  render() {
    const {subscription} = this.props;
    const {programType, notes} = this.state;

    if (!subscription) {
      return null;
    }

    const programDescription = programType ? this.getProgramDescription(programType) : '';

    return (
      <Fragment>
        <Alert.Container>
          <Alert type="info" showIcon>
            This will grant the customer access to the selected startups program and send them a welcome email.
          </Alert>
        </Alert.Container>

        {programDescription && (
          <Alert.Container>
            <Alert type="success" showIcon>
              {programDescription}
            </Alert>
          </Alert.Container>
        )}

        <SelectField
          required
          inline={false}
          stacked
          flexibleControlStateSize
          label="Startups Program"
          name="programType"
          value={programType}
          onChange={this.handleProgramTypeChange}
          help="Select which startups program to enroll this customer in"
          choices={[
            ['ycombinator', 'YCombinator (Current)'],
            ['other', 'Other'],
          ]}
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
