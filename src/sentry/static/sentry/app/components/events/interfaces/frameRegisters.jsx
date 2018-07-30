import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import {objectToArray} from 'app/utils';

const REGISTER_VIEWS = [
  'Hexadecimal',
  'Big Endian',
  'Little Endian'
]

class RegisterValue extends React.Component {
  static propTypes = {
    value: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      view: 0,
    };
  }

  toggleView = () => {
    this.setState({
      view: (this.state.view + 1) % REGISTER_VIEWS.length,
    });
  };

  formatValue = (value) => {
    try {
      switch (this.state.view) {
        case 0:
          return value;
        case 1:
          return parseInt(value);
        case 2:
          return parseInt('0x' + value.slice(2).match(/../g).reverse().join(''));
        default:
          return value;
      }
    } catch (e) {
      return value;
    }
  }

  render() {
    return (
      <InlinePre>
        <FixedWidth>{this.formatValue(this.props.value)}</FixedWidth>
        <Tooltip title={REGISTER_VIEWS[this.state.view]} onClick={this.toggleView}>
          <Toggle className="icon-filter" />
        </Tooltip>
      </InlinePre>
    )
  }
}

class FrameRegisters extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  // make sure that clicking on the registers does not actually do
  // anything on the containing element.
  preventToggling = evt => {
    evt.stopPropagation();
  };

  render() {
    let registers = objectToArray(this.props.data);

    return (
      <div>
        <RegistersHeading>Register Values</RegistersHeading>
        <Registers>
          {registers.map(register => (
            <Register key={register[0]} onClick={this.preventToggling}>
              <RegisterName>{register[0]}</RegisterName>
              {' '}
              <RegisterValue value={register[1]} />
            </Register>
          ))}
        </Registers>
      </div>
    );
  }
}

const Registers = styled(Flex)`
  flex-wrap: wrap;
  padding: 8px 10px;
`;

const Register = styled(Box)`
  padding: 6px 10px;
`;

const RegistersHeading = styled.strong`
  font-size: 90%;
`;

const RegisterName = styled.span`
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  padding-right: 1em;
  text-align: right;
  width: 5em;
`;

const InlinePre = styled.pre`
  display: inline;
`;

const FixedWidth = styled.span`
  width: 12em;
  text-align: right;
`;

const Toggle = styled.span`
  opacity: 0.33;
  margin-left: 1ex;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;

export default FrameRegisters;
