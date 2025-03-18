import {Fragment} from 'react';
import styled from '@emotion/styled';

import Spinner from 'sentry/components/forms/spinner';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {fadeOut, pulse} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';

export interface ControlStateProps {
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
        <ControlStateWrapper>
          <FormSpinner data-test-id="saving" />
        </ControlStateWrapper>
      ) : isSaved ? (
        <ControlStateWrapper>
          <StyledIconCheckmark color="success" size="sm" />
        </ControlStateWrapper>
      ) : null}

      {error ? (
        <ControlStateWrapper>
          <Tooltip
            position="bottom"
            offset={8}
            title={!hideErrorMessage && error}
            forceVisible
            skipWrapper
          >
            <StyledIconWarning color="error" size="sm" />
          </Tooltip>
        </ControlStateWrapper>
      ) : null}
    </Fragment>
  );
}

const ControlStateWrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  animation: ${fadeOut} 0.3s ease 2s 1 forwards;
`;

const StyledIconWarning = styled(IconWarning)`
  animation: ${() => pulse(1.15)} 1s ease infinite;
`;

const FormSpinner = styled(Spinner)`
  margin-left: 0;
`;
