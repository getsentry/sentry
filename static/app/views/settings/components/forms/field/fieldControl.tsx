import React from 'react';
import styled from '@emotion/styled';

import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';
import FieldControlState from 'app/views/settings/components/forms/field/fieldControlState';

const defaultProps = {
  flexibleControlStateSize: false,
};

type Props = Partial<typeof defaultProps> & {
  children: React.ReactNode;
  /**
   * Display the field control container in "inline" fashion. The label and
   * description will be aligned to the left, while the control itself will be
   * aligned to the right.
   */
  inline?: boolean;
  /**
   * Align the control towards the right
   */
  alignRight?: boolean;
  /**
   * Loading / Saving / Error states of the form. See the ControlState
   */
  controlState?: React.ReactNode;
  /**
   * Hide the fields control state
   */
  hideControlState?: boolean;
  /**
   * Disable the field
   */
  disabled?: boolean;
  /**
   * Produces a question tooltip on the field, explaining why it is disabled
   */
  disabledReason?: React.ReactNode;
  /**
   * The error state. Will not be rendered if hideControlState is true
   */
  errorState?: React.ReactNode;
  /**
   * Allow the control state to flex based on its content. When enabled the
   * control state element will NOT take up space unless it has some state to
   * show (such as an error).
   */
  flexibleControlStateSize?: boolean;
};

const FieldControl = ({
  inline,
  alignRight,
  disabled,
  disabledReason,
  errorState,
  controlState,
  children,
  hideControlState,
  flexibleControlStateSize = false,
}: Props) => (
  <FieldControlErrorWrapper inline={inline}>
    <FieldControlWrapper>
      <FieldControlStyled alignRight={alignRight}>{children}</FieldControlStyled>

      {disabled && disabledReason && (
        <DisabledIndicator className="disabled-indicator">
          <StyledQuestionTooltip title={disabledReason} size="sm" position="top" />
        </DisabledIndicator>
      )}

      {!hideControlState && (
        <FieldControlState flexibleControlStateSize={!!flexibleControlStateSize}>
          {controlState}
        </FieldControlState>
      )}
    </FieldControlWrapper>

    {!hideControlState && errorState}
  </FieldControlErrorWrapper>
);

export default FieldControl;

// This wraps Control + ControlError message
// * can NOT be a flex box here because of `position: absolute` on "control error message"
// * can NOT have overflow hidden because "control error message" overflows
const FieldControlErrorWrapper = styled('div')<{inline?: boolean}>`
  ${p => (p.inline ? 'width: 50%; padding-left: 10px;' : '')};
`;

const FieldControlStyled = styled('div')<{alignRight?: boolean}>`
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
  ${p => (p.alignRight ? 'align-items: flex-end;' : '')};
`;

const FieldControlWrapper = styled('div')`
  display: flex;
  flex-shrink: 0;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  display: block;
  margin: 0 auto;
`;

const DisabledIndicator = styled('div')`
  display: flex;
  align-items: center;
  margin-left: ${space(1)};
`;
