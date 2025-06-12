import {Component, Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import ConfigStore from 'sentry/stores/configStore';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type StartupsProgram = {
  name: string;
  type: string;
  creditAmount: number;
};

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
};

type State = {
  notes?: string;
  programId?: string | null;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class StartupsAction extends Component<Props, State> {
  state: State = {
    programId: undefined, // Will be set to first program in componentDidMount
    notes: '',
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
    this.props.disableConfirmButton(false);

    // Set default to first available program
    const programs = this.getStartupsPrograms();
    const programIds = Object.keys(programs);
    if (programIds.length > 0) {
      this.setState({programId: programIds[0]});
    }
  }

  getStartupsPrograms = (): Record<string, StartupsProgram> => {
    // Get startups programs from configuration
    const config = ConfigStore.get('startupsPrograms') || {};
    return config;
  };

  handleProgramChange = (value: string | null) => {
    this.setState({programId: value});
  };

  handleNotesChange = (value: string) => {
    this.setState({notes: value});
  };

  handleConfirm = (_params: AdminConfirmParams) => {
    const {programId, notes} = this.state;
    const {onConfirm} = this.props;

    const data = {
      startupsProgram: true,
      programId,
      notes,
    };
    onConfirm?.(data);
  };

  getProgramDescription = (programId: string | null) => {
    if (!programId) {
      return '';
    }

    const programs = this.getStartupsPrograms();
    const program = programs[programId];

    if (!program) {
      return '';
    }

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(program.creditAmount);

    return `${formattedAmount} in credits for ${program.name}`;
  };

  render() {
    const {subscription} = this.props;
    const {programId, notes} = this.state;

    if (!subscription) {
      return null;
    }

    const programs = this.getStartupsPrograms();
    const programChoices = Object.entries(programs).map(([id, program]) => [
      id,
      program.name,
    ]);

    const programDescription = programId ? this.getProgramDescription(programId) : '';

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
          name="programId"
          value={programId}
          onChange={this.handleProgramChange}
          help="Select which startups program to enroll this customer in"
          choices={programChoices}
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
