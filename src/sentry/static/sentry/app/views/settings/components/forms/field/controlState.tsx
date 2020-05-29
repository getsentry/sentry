import React from 'react';
import styled from '@emotion/styled';

import {fadeOut, pulse} from 'app/styles/animations';
import InlineSvg from 'app/components/inlineSvg';
import Spinner from 'app/views/settings/components/forms/spinner';

type Props = {
  isSaving?: boolean;
  isSaved?: boolean;
  error?: string | boolean;
};

/**
 * ControlState (i.e. loading/error icons) for form fields
 */
class ControlState extends React.Component<Props> {
  render() {
    const {isSaving, isSaved, error} = this.props;

    return (
      <React.Fragment>
        {isSaving ? (
          <ControlStateWrapper>
            <FormSpinner />
          </ControlStateWrapper>
        ) : isSaved ? (
          <ControlStateWrapper>
            <FieldIsSaved>
              <InlineSvg src="icon-checkmark-sm" size="18px" />
            </FieldIsSaved>
          </ControlStateWrapper>
        ) : null}

        {error ? (
          <ControlStateWrapper>
            <FieldError>
              <InlineSvg src="icon-warning-sm" size="18px" />
            </FieldError>
          </ControlStateWrapper>
        ) : null}
      </React.Fragment>
    );
  }
}

const ControlStateWrapper = styled('div')`
  padding: 0 8px;
`;

const FieldIsSaved = styled('div')`
  color: ${p => p.theme.green400};
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
  color: ${p => p.theme.redDark};
  animation: ${() => pulse(1.15)} 1s ease infinite;
`;
export default ControlState;
