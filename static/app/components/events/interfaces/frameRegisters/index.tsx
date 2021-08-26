import * as React from 'react';
import styled from '@emotion/styled';

import {getMeta} from 'app/components/events/meta/metaProxy';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {defined} from 'app/utils';

import {getSortedRegisters} from './utils';
import Value from './value';

type Props = {
  registers: Record<string, string>;
  deviceArch?: string;
};

function FrameRegisters({registers, deviceArch}: Props) {
  // make sure that clicking on the registers does not actually do
  // anything on the containing element.
  const handlePreventToggling = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const sortedRegisters = getSortedRegisters(registers, deviceArch);

  return (
    <Wrapper>
      <Heading>{t('registers')}</Heading>
      <Registers>
        {sortedRegisters.map(([name, value]) => {
          if (!defined(value)) {
            return null;
          }
          return (
            <Register key={name} onClick={handlePreventToggling}>
              <Name>{name}</Name>
              <Value value={value} meta={getMeta(registers, name)} />
            </Register>
          );
        })}
      </Registers>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  padding-top: 10px;
`;

const Registers = styled('div')`
  display: flex;
  flex-wrap: wrap;
  margin-left: 125px;
  padding: ${space(0.25)} 0px;
`;

const Register = styled('div')`
  padding: ${space(0.5)} 5px;
`;

const Heading = styled('strong')`
  font-weight: 600;
  font-size: 13px;
  width: 125px;
  max-width: 125px;
  word-wrap: break-word;
  padding: 10px 15px 10px 0;
  line-height: 1.4;
  float: left;
`;

const Name = styled('span')`
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  width: 4em;
`;

export default FrameRegisters;
