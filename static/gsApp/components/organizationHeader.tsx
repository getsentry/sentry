import {Fragment} from 'react';

import type {Organization} from 'sentry/types/organization';

import EmployeeFeedbackButton from 'getsentry/components/employeeFeedbackButton';
import GSBanner from 'getsentry/components/gsBanner';
import useFeedbackInit from 'getsentry/utils/useFeedbackInit';
import useReplayInit from 'getsentry/utils/useReplayInit';

interface Props {
  organization: Organization;
}

export function OrganizationHeader({organization}: Props) {
  const showDevToolbar = organization.features.includes('devtoolbar');

  // The employee feedback button was the precursor to the toolbar, we only need to show one at a time
  const showEmployeeFeedbackButton = !showDevToolbar;

  useFeedbackInit();
  useReplayInit({organization});

  return (
    <Fragment>
      <GSBanner organization={organization} />
      {showEmployeeFeedbackButton ? <EmployeeFeedbackButton /> : null}
    </Fragment>
  );
}
