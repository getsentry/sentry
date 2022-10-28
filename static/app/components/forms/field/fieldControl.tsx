import styled from '@emotion/styled';

import QuestionTooltip from 'sentry/components/questionTooltip';
import space from 'sentry/styles/space';

import FieldControlState from './fieldControlState';
import {FieldGroupProps} from './types';

type FieldControlProps = Pick<
  FieldGroupProps,
  | 'alignRight'
  | 'controlState'
  | 'disabled'
  | 'disabledReason'
  | 'errorState'
  | 'flexibleControlStateSize'
  | 'hideControlState'
  | 'inline'
> & {
  children: React.ReactNode;
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
  flexibleControlStateSize,
}: FieldControlProps) => (
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
