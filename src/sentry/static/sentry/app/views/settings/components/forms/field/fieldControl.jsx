import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import FieldControlState from './fieldControlState';
import Tooltip from '../../../../../components/tooltip';

// This wraps Control + ControlError message
// * can NOT be a flex box have because of position: absolute on "control error message"
// * can NOT have overflow hidden because "control error message" overflows
const FieldControlErrorWrapper = styled(({inline, ...props}) => <Box {...props} />)`
  ${p => (p.inline ? 'width: 50%; padding-left: 10px;' : '')};
`;

const FieldControlStyled = styled(({alignRight, ...props}) => <Box {...props} />)`
  color: ${p => p.theme.gray3};
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
  ${p => (p.alignRight ? 'align-items: flex-end;' : '')};
`;

const FieldControlWrapper = styled(({hasControlState, ...props}) => <Flex {...props} />)`
  flex-shrink: 0;
`;

class FieldControl extends React.Component {
  static propTypes = {
    inline: PropTypes.bool,
    alignRight: PropTypes.bool,
    disabled: PropTypes.bool,
    disabledReason: PropTypes.node,
    hideControlState: PropTypes.bool,
    controlState: PropTypes.node,
    errorState: PropTypes.node,
  };

  static defaultProps = {
    hideControlState: false,
  };

  render() {
    let {
      inline,
      alignRight,
      disabled,
      disabledReason,
      hideControlState,
      errorState,
      controlState,
      children,
    } = this.props;

    return (
      <FieldControlErrorWrapper inline={inline}>
        <FieldControlWrapper>
          <FieldControlStyled alignRight={alignRight}>{children}</FieldControlStyled>

          {disabled &&
            disabledReason && (
              <Tooltip title={disabledReason}>
                <span className="disabled-indicator">
                  <span className="icon-question" />
                </span>
              </Tooltip>
            )}

          {!hideControlState && <FieldControlState>{controlState}</FieldControlState>}
        </FieldControlWrapper>

        {errorState}
      </FieldControlErrorWrapper>
    );
  }
}
export default FieldControl;
