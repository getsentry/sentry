import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import FieldControlState from 'app/views/settings/components/forms/field/fieldControlState';
import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

const defaultProps = {
  flexibleControlStateSize: false,
};

type Props = Partial<typeof defaultProps> & {
  inline?: boolean;
  alignRight?: boolean;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  controlState?: React.ReactNode;
  errorState?: React.ReactNode;
};

class FieldControl extends React.Component<Props> {
  static propTypes = {
    inline: PropTypes.bool,
    alignRight: PropTypes.bool,
    disabled: PropTypes.bool,
    disabledReason: PropTypes.node,
    flexibleControlStateSize: PropTypes.bool,
    controlState: PropTypes.node,
    errorState: PropTypes.node,
  };

  static defaultProps = defaultProps;

  render() {
    const {
      inline,
      alignRight,
      disabled,
      disabledReason,
      flexibleControlStateSize,
      errorState,
      controlState,
      children,
    } = this.props;

    return (
      <FieldControlErrorWrapper inline={inline}>
        <FieldControlWrapper>
          <FieldControlStyled alignRight={alignRight}>{children}</FieldControlStyled>

          {disabled && disabledReason && (
            <DisabledIndicator className="disabled-indicator">
              <Tooltip title={disabledReason}>
                <StyledInlineSvg src="icon-circle-question" size="18px" />
              </Tooltip>
            </DisabledIndicator>
          )}

          <FieldControlState flexibleControlStateSize={!!flexibleControlStateSize}>
            {controlState}
          </FieldControlState>
        </FieldControlWrapper>

        {errorState}
      </FieldControlErrorWrapper>
    );
  }
}
export default FieldControl;

// This wraps Control + ControlError message
// * can NOT be a flex box here because of `position: absolute` on "control error message"
// * can NOT have overflow hidden because "control error message" overflows
const FieldControlErrorWrapper = styled('div')<{inline?: boolean}>`
  ${p => (p.inline ? 'width: 50%; padding-left: 10px;' : '')};
`;

const FieldControlStyled = styled('div')<{alignRight?: boolean}>`
  color: ${p => p.theme.gray3};
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

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
  color: ${p => p.theme.gray1};
  margin: 0 auto;
  cursor: pointer;
  transition: 0.15s color;

  &:hover {
    color: ${p => p.theme.gray3};
  }
`;

const DisabledIndicator = styled('div')`
  display: flex;
  align-items: center;
  margin-left: ${space(1)};
`;
