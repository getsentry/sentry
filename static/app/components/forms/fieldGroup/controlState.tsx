import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconWarning} from '@sentry/icons/warning';

import {Grid} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Spinner} from 'sentry/components/forms/spinner';
import {fadeOut, pulse} from 'sentry/styles/animations';

interface ControlStateProps {
  /**
   * Display the  error indicator
   */
  error?: string | boolean;
  /**
   * Should hide error message?
   */
  hideErrorMessage?: boolean;
  /**
   * Display the "was just saved" state
   */
  isSaved?: boolean;
  /**
   * Display the saving state
   */
  isSaving?: boolean;
}

/**
 * ControlState (i.e. loading/error icons) for form fields
 */
export function ControlState({
  isSaving,
  isSaved,
  error,
  hideErrorMessage,
}: ControlStateProps) {
  return (
    <Fragment>
      {isSaving ? (
        <Grid align="center" gap="xs" flow="column">
          <FormSpinner data-test-id="saving" />
        </Grid>
      ) : isSaved ? (
        <Grid align="center" gap="xs" flow="column">
          <StyledIconCheckmark variant="success" size="sm" />
        </Grid>
      ) : null}

      {error ? (
        <Grid align="center" gap="xs" flow="column">
          <Tooltip
            position="bottom"
            offset={8}
            title={!hideErrorMessage && error}
            forceVisible
            skipWrapper
          >
            <StyledIconWarning variant="danger" size="sm" />
          </Tooltip>
        </Grid>
      ) : null}
    </Fragment>
  );
}

const StyledIconCheckmark = styled(IconCheckmark)`
  animation: ${fadeOut} 0.3s ease 2s 1 forwards;
`;

const StyledIconWarning = styled(IconWarning)`
  animation: ${() => pulse(1.15)} 1s ease infinite;
`;

const FormSpinner = styled(Spinner)`
  margin-left: 0;
`;
