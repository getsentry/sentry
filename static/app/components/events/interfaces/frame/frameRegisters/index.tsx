import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import {getSortedRegisters} from './utils';
import {FrameRegisterValue} from './value';

type Props = {
  registers: Record<string, string | null>;
  deviceArch?: string;
  meta?: Record<any, any>;
};

const CLIPPED_HEIGHT = 120;

export function FrameRegisters({registers, deviceArch, meta}: Props) {
  // make sure that clicking on the registers does not actually do
  // anything on the containing element.
  const handlePreventToggling = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const sortedRegisters = getSortedRegisters(registers, deviceArch);

  return (
    <Wrapper>
      <StyledClippedBox clipHeight={CLIPPED_HEIGHT}>
        <RegistersTitle>{t('Registers')}</RegistersTitle>
        <Registers>
          {sortedRegisters.map(([name, value]) => {
            if (!defined(value)) {
              return null;
            }
            return (
              <Register key={name} onClick={handlePreventToggling}>
                {name}
                <FrameRegisterValue value={value} meta={meta?.[name]?.['']} />
              </Register>
            );
          })}
        </Registers>
      </StyledClippedBox>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${space(0.5)} ${space(1.5)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding: 18px 36px;
  }
`;

const RegistersTitle = styled('div')`
  width: 80px;
  padding: ${space(1)} 0;
`;

const Registers = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14.063rem, 1fr));
  gap: ${space(1)};
  flex-grow: 1;
`;

const Register = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: 3em 1fr;
  align-items: center;
  color: ${p => p.theme.gray300};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    text-align: right;
  }
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;
