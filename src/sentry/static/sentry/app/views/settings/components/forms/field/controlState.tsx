import React from 'react';
import styled from '@emotion/styled';

import {IconCheckmark, IconWarning} from 'app/icons';
import {fadeOut, pulse} from 'app/styles/animations';
import Spinner from 'app/views/settings/components/forms/spinner';

type Props = {
  /**
   * Display the saving state
   */
  isSaving?: boolean;
  /**
   * Display the "was just saved" state
   */
  isSaved?: boolean;
  /**
   * Display the  error indicator
   */
  error?: string | boolean;
};

/**
 * ControlState (i.e. loading/error icons) for form fields
 */
const ControlState = ({isSaving, isSaved, error}: Props) => (
  <React.Fragment>
    {isSaving ? (
      <ControlStateWrapper>
        <FormSpinner />
      </ControlStateWrapper>
    ) : isSaved ? (
      <ControlStateWrapper>
        <FieldIsSaved>
          <IconCheckmark size="18px" />
        </FieldIsSaved>
      </ControlStateWrapper>
    ) : null}

    {error ? (
      <ControlStateWrapper>
        <FieldError>
          <IconWarning size="18px" />
        </FieldError>
      </ControlStateWrapper>
    ) : null}
  </React.Fragment>
);

const ControlStateWrapper = styled('div')`
  padding: 0 8px;
`;

const FieldIsSaved = styled('div')`
  color: ${p => p.theme.green300};
  animation: ${fadeOut} 0.3s ease 2s 1 forwards;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FormSpinner = styled(Spinner)`
  margin-left: 0;
`;

const FieldError = styled('div')`
  color: ${p => p.theme.red300};
  animation: ${() => pulse(1.15)} 1s ease infinite;
`;
export default ControlState;
