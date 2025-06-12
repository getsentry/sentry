import {Fragment, useEffect, useState} from 'react';

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

/**
 * Rendered as part of a openAdminConfirmModal call
 */
function StartupsAction({subscription, setConfirmCallback, disableConfirmButton, onConfirm}: Props) {
  const [programId, setProgramId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const getStartupsPrograms = (): Record<string, StartupsProgram> => {
    // Get startups programs from configuration
    const config = ConfigStore.get('startupsPrograms') || {};
    return config;
  };

  useEffect(() => {
    setConfirmCallback(handleConfirm);
    disableConfirmButton(false);

    // Set default to first available program
    const programs = getStartupsPrograms();
    const programIds = Object.keys(programs);
    if (programIds.length > 0) {
      setProgramId(programIds[0]);
    }
  }, [setConfirmCallback, disableConfirmButton]);

  const handleConfirm = (_params: AdminConfirmParams) => {
    const data = {
      startupsProgram: true,
      programId,
      notes,
    };
    onConfirm?.(data);
  };

  const handleProgramChange = (value: string | null) => {
    setProgramId(value);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
  };

  const getProgramDescription = (programId: string | null) => {
    if (!programId) {
      return '';
    }

    const programs = getStartupsPrograms();
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

  if (!subscription) {
    return null;
  }

  const programs = getStartupsPrograms();
  const programChoices = Object.entries(programs).map(([id, program]) => [
    id,
    program.name,
  ]);

  const programDescription = programId ? getProgramDescription(programId) : '';

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
        onChange={handleProgramChange}
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
        onChange={handleNotesChange}
        help="Optional notes about this startups program enrollment"
        placeholder="Notes about why this customer was granted access to the startups program..."
      />
    </Fragment>
  );
}

export default StartupsAction;
