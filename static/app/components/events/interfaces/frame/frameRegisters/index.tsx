import styled from '@emotion/styled';

import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

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
      <Title>{t('Registers')}</Title>
      <Registers>
        {sortedRegisters.map(([name, value]) => {
          if (!defined(value)) {
            return null;
          }
          return (
            <Register key={name} onClick={handlePreventToggling}>
              {name}
              <Value value={value} meta={getMeta(registers, name)} />
            </Register>
          );
        })}
      </Registers>
    </Wrapper>
  );
}

export default FrameRegisters;

const Wrapper = styled('div')`
  padding: ${space(1)} ${space(1)} ${space(1)} calc(${space(4)} + ${space(0.25)});
  display: grid;
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1rem;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 132px 1fr;
  }
`;

const Title = styled('div')`
  padding-right: ${space(1)};
  padding-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: 0;
    padding-right: ${space(1)};
  }
`;

const Registers = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14.063rem, 1fr));
  gap: ${space(1)};
`;

const Register = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: 3em 1fr;
  align-items: center;
  color: ${p => p.theme.gray300};
`;
