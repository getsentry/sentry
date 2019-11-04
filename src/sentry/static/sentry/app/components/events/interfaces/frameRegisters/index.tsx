import React from 'react';
import styled from 'react-emotion';

import {defined} from 'app/utils';
import {t} from 'app/locale';
import RegisterValue from 'app/components/events/interfaces/frameRegisters/registerValue';

type Props = {
  data: {[key: string]: string};
};

class FrameRegisters extends React.Component<Props> {
  // make sure that clicking on the registers does not actually do
  // anything on the containing element.
  preventToggling = (evt: React.MouseEvent<HTMLDivElement>) => {
    evt.stopPropagation();
  };

  render() {
    return (
      <RegistersWrapper>
        <RegistersHeading>{t('registers')}</RegistersHeading>
        <Registers>
          {Object.entries(this.props.data).map(([name, value]) => {
            if (defined(value)) {
              return (
                <Register key={name} onClick={this.preventToggling}>
                  <RegisterName>{name}</RegisterName> <RegisterValue value={value} />
                </Register>
              );
            }

            return null;
          })}
        </Registers>
      </RegistersWrapper>
    );
  }
}

const RegistersWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.borderLight};
  padding-top: 10px;

  .traceback .frame .box-clippable:first-child > & {
    border-top: none;
    padding-top: 0;
  }
`;

const Registers = styled('div')`
  display: flex;
  flex-wrap: wrap;
  margin-left: 125px;
  padding: 2px 0px;
`;

const Register = styled('div')`
  padding: 4px 5px;
`;

const RegistersHeading = styled('strong')`
  font-weight: 600;
  font-size: 13px;
  width: 125px;
  max-width: 125px;
  word-wrap: break-word;
  padding: 10px 15px 10px 0;
  line-height: 1.4;
  float: left;
`;

const RegisterName = styled('span')`
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  width: 4em;
`;

export default FrameRegisters;
