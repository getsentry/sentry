import React from 'react';
import styled from '@emotion/styled';

import {defined} from 'app/utils';
import {t} from 'app/locale';
import FrameRegistersValue from 'app/components/events/interfaces/frameRegisters/frameRegistersValue';
import {getMeta} from 'app/components/events/meta/metaProxy';

type Props = {
  data: {[key: string]: string};
};

const FrameRegisters = ({data}: Props) => {
  // make sure that clicking on the registers does not actually do
  // anything on the containing element.
  const handlePreventToggling = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <RegistersWrapper>
      <RegistersHeading>{t('registers')}</RegistersHeading>
      <Registers>
        {Object.entries(data).map(([name, value]) => {
          if (!defined(value)) {
            return null;
          }
          return (
            <Register key={name} onClick={handlePreventToggling}>
              <RegisterName>{name}</RegisterName>
              <FrameRegistersValue value={value} meta={getMeta(data, name)} />
            </Register>
          );
        })}
      </Registers>
    </RegistersWrapper>
  );
};

const RegistersWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding-top: 10px;
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
