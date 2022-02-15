import * as React from 'react';
import styled from '@emotion/styled';

import FieldControlState from 'sentry/components/forms/field/fieldControlState';
import QuestionTooltip from 'sentry/components/questionTooltip';
import space from 'sentry/styles/space';

const defaultProps = {
  flexibleControlStateSize: false,
};

type Props = Partial<typeof defaultProps> & {
  children: React.ReactNode;
  /**
   * Align the control towards the right
   */
  alignRight?: boolean;
  /**
   * Loading / Saving / Error states of the form. See the ControlState
   */
  controlState?: React.ReactNode;
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
  /**
   * Hide the fields control state
   */
  hideControlState?: boolean;
  /**
   * Display the field control container in "inline" fashion. The label and
   * description will be aligned to the left, while the control itself will be
   * aligned to the right.
   */
  inline?: boolean;
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
  position: relative;
`;

const FieldControlStyled = styled('div')<{alignRight?: boolean}>`
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
  max-width: 100%;
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
