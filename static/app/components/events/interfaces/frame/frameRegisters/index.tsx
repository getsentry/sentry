import {useMemo} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import {getSortedRegisters} from './utils';
import {FrameRegisterValue} from './value';

type Props = {
  registers: NonNullable<StacktraceType['registers']>;
  deviceArch?: string;
  meta?: Record<any, any>;
};

const CLIPPED_HEIGHT = 250;

export function FrameRegisters({registers, deviceArch, meta}: Props) {
  const sortedRegisters = useMemo(
    () => getSortedRegisters(registers, deviceArch),
    [registers, deviceArch]
  );

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
              <Register key={name}>
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

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    padding: ${space(1)} ${space(3)} ${space(2)};
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
  color: ${p => p.theme.tokens.content.secondary};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    text-align: right;
  }
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;
