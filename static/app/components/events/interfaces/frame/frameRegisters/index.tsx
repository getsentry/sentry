import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {ClippedBox} from 'sentry/components/clippedBox';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import {getSortedRegisters} from './utils';
import {FrameRegisterValue} from './value';

type Props = {
  registers: NonNullable<StacktraceType['registers']>;
  collapsible?: boolean;
  deviceArch?: string;
  meta?: Record<any, any>;
};

const CLIPPED_HEIGHT = 250;

export function FrameRegisters({registers, deviceArch, meta, collapsible}: Props) {
  const [expanded, setExpanded] = useState(!collapsible);

  const sortedRegisters = useMemo(
    () => getSortedRegisters(registers, deviceArch),
    [registers, deviceArch]
  );

  return (
    <Wrapper>
      <StyledClippedBox clipHeight={CLIPPED_HEIGHT}>
        <RegistersTitle
          as={collapsible ? 'button' : 'div'}
          clickable={collapsible}
          onClick={collapsible ? () => setExpanded(prev => !prev) : undefined}
        >
          {collapsible && (
            <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
          )}
          {t('Registers')}
        </RegistersTitle>
        {expanded && (
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
        )}
      </StyledClippedBox>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    padding: ${p => p.theme.space.md} ${p => p.theme.space['2xl']}
      ${p => p.theme.space.xl};
  }
`;

const RegistersTitle = styled('div')<{clickable?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.md} 0;
  background: none;
  border: none;
  font: inherit;
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  color: ${p => (p.clickable ? p.theme.tokens.content.secondary : 'inherit')};

  &:hover {
    color: ${p => (p.clickable ? p.theme.tokens.content.primary : 'inherit')};
  }
`;

const Registers = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14.063rem, 1fr));
  gap: ${p => p.theme.space.md};
  flex-grow: 1;
`;

const Register = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xs};
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
