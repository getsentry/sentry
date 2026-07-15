import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {ClippedBox} from 'sentry/components/clippedBox';
import {t} from 'sentry/locale';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils/defined';

import {getSortedRegisters} from './utils';
import {FrameRegisterValue} from './value';

type Props = {
  deviceArch: string | undefined;
  meta: Record<any, any> | undefined;
  registers: NonNullable<StacktraceType['registers']>;
};

const CLIPPED_HEIGHT = 250;
type RegisterFormat = 'hexadecimal' | 'decimal';

export function FrameRegisters({registers, deviceArch, meta}: Props) {
  const [registerFormat, setRegisterFormat] = useState<RegisterFormat>('hexadecimal');
  const sortedRegisters = useMemo(
    () => getSortedRegisters(registers, deviceArch),
    [registers, deviceArch]
  );

  function handleRegisterFormatChange(format: RegisterFormat) {
    setRegisterFormat(format);
  }

  return (
    <Container padding={{'screen:2xs': 'xs lg', 'screen:sm': 'md 2xl xl'}}>
      <StyledClippedBox clipHeight={CLIPPED_HEIGHT}>
        <Stack gap="md">
          <Flex align="center" justify="between" gap="md" wrap="wrap" paddingLeft="sm">
            <Text as="div" size="md">
              {t('Registers')}
            </Text>
            <SegmentedControl
              aria-label={t('Register value format')}
              size="xs"
              value={registerFormat}
              onChange={handleRegisterFormatChange}
            >
              <SegmentedControl.Item key="hexadecimal">
                {t('Hexadecimal')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="decimal">{t('Decimal')}</SegmentedControl.Item>
            </SegmentedControl>
          </Flex>
          <Grid columns="repeat(auto-fit, minmax(min(100%, 14rem), 1fr))" gap="lg 2xl">
            {sortedRegisters.map(([name, value]) => {
              if (!defined(value)) {
                return null;
              }

              return (
                <Grid
                  key={name}
                  columns="minmax(1.5rem, max-content) minmax(0, 1fr)"
                  align="center"
                  gap="md"
                >
                  <Text monospace align="right" variant="muted">
                    {name}
                  </Text>
                  <FrameRegisterValue
                    value={value}
                    meta={meta?.[name]?.['']}
                    isHexadecimal={registerFormat === 'hexadecimal'}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </StyledClippedBox>
    </Container>
  );
}

const StyledClippedBox = styled(ClippedBox)`
  padding: ${p => p.theme.space.sm} 0;
`;
