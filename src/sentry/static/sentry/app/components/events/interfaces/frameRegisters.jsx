import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {defined, objectToArray} from 'app/utils';

const REGISTER_VIEWS = [t('Hexadecimal'), t('Numeric')];

export class RegisterValue extends React.Component {
  static propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      view: 0,
    };
  }

  toggleView = () => {
    this.setState(state => ({view: (state.view + 1) % REGISTER_VIEWS.length}));
  };

  formatValue = value => {
    try {
      const parsed = typeof value === 'string' ? parseInt(value, 16) : value;
      if (isNaN(parsed)) return value;

      switch (this.state.view) {
        case 1:
          return `${parsed}`;
        case 0:
        default:
          return `0x${('0000000000000000' + parsed.toString(16)).substr(-16)}`;
      }
    } catch (e) {
      return value;
    }
  };

  render() {
    return (
      <InlinePre>
        <FixedWidth>{this.formatValue(this.props.value)}</FixedWidth>
        <Tooltip title={REGISTER_VIEWS[this.state.view]} onClick={this.toggleView}>
          <Toggle className="icon-filter" />
        </Tooltip>
      </InlinePre>
    );
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
    const registers = objectToArray(this.props.data).filter(register =>
      defined(register[1])
    );

    return (
      <RegistersWrapper>
        <RegistersHeading>{t('registers')}</RegistersHeading>
        <Registers>
          {registers.map(register => (
            <Register key={register[0]} onClick={this.preventToggling}>
              <RegisterName>{register[0]}</RegisterName>{' '}
              <RegisterValue value={register[1]} />
            </Register>
          ))}
        </Registers>
      </RegistersWrapper>
    );
  }
}

const RegistersWrapper = styled.div`
  border-top: 1px solid @trim;
  padding-top: 10px;

  .traceback .frame .box-clippable:first-child > & {
    border-top: none;
    padding-top: 0;
  }
`;

const Registers = styled(Flex)`
  flex-wrap: wrap;
  margin-left: 125px;
  padding: 2px 0px;
`;

const Register = styled(Box)`
  padding: 4px 5px;
`;

const RegistersHeading = styled.strong`
  font-weight: 600;
  font-size: 13px;
  width: 125px;
  max-width: 125px;
  word-wrap: break-word;
  padding: 10px 15px 10px 0;
  line-height: 1.4;
  float: left;
`;

const RegisterName = styled.span`
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  width: 4em;
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
