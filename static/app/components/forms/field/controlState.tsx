import {Fragment} from 'react';
import styled from '@emotion/styled';

import Spinner from 'sentry/components/forms/spinner';
import Tooltip from 'sentry/components/tooltip';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';

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
const ControlState = ({
  isSaving,
  isSaved,
  error,
  hideErrorMessage,
}: ControlStateProps) => (
  <Fragment>
    {isSaving ? (
      <ControlStateWrapper>
        <FormSpinner data-test-id="saving" />
      </ControlStateWrapper>
    ) : isSaved ? (
      <ControlStateWrapper>
        <FieldIsSaved>
          <IconCheckmark size="sm" />
        </FieldIsSaved>
      </ControlStateWrapper>
    ) : null}

    {error ? (
      <ControlStateWrapper>
        <Tooltip
          position="bottom"
          offset={8}
          title={!hideErrorMessage && error}
          forceVisible
        >
          <FieldError>
            <IconWarning size="sm" />
          </FieldError>
        </Tooltip>
      </ControlStateWrapper>
    ) : null}
  </Fragment>
);

const ControlStateWrapper = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.5)};
`;

const FieldIsSaved = styled('div')`
  color: ${p => p.theme.success};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FormSpinner = styled(Spinner)`
  margin-left: 0;
`;

const FieldError = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.error};
`;
export default ControlState;
