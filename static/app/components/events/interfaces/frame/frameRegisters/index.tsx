import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
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
  /**
   * Start collapsed behind a toggle. For frames that show extracted variables,
   * which answer most of what the registers are read for.
   */
  collapsedByDefault?: boolean;
};

const CLIPPED_HEIGHT = 250;
type RegisterFormat = 'hexadecimal' | 'decimal';

export function FrameRegisters({
  registers,
  deviceArch,
  meta,
  collapsedByDefault = false,
}: Props) {
  const [registerFormat, setRegisterFormat] = useState<RegisterFormat>('hexadecimal');
  const [expanded, setExpanded] = useState(!collapsedByDefault);
  const sortedRegisters = useMemo(
    () => getSortedRegisters(registers, deviceArch),
    [registers, deviceArch]
  );

  function handleRegisterFormatChange(format: RegisterFormat) {
    setRegisterFormat(format);
  }

  const formatControl = (
    <SegmentedControl
      aria-label={t('Register value format')}
      size="xs"
      value={registerFormat}
      onChange={handleRegisterFormatChange}
    >
      <SegmentedControl.Item key="hexadecimal">{t('Hexadecimal')}</SegmentedControl.Item>
      <SegmentedControl.Item key="decimal">{t('Decimal')}</SegmentedControl.Item>
    </SegmentedControl>
  );

  const registerGrid = (
    <Grid
      columns="repeat(auto-fit, minmax(min(100%, 14rem), 1fr))"
      gap="lg 2xl"
      paddingLeft="sm"
    >
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
  );

  if (collapsedByDefault) {
    return (
      <Container borderTop="primary" padding="xs lg">
        <Disclosure
          expanded={expanded}
          onExpandedChange={setExpanded}
          size="sm"
          width="100%"
        >
          <Disclosure.Title trailingItems={expanded ? formatControl : undefined}>
            {t('Registers')}
          </Disclosure.Title>
          <Disclosure.Content>
            {expanded && (
              <StyledClippedBox clipHeight={CLIPPED_HEIGHT}>
                {registerGrid}
              </StyledClippedBox>
            )}
          </Disclosure.Content>
        </Disclosure>
      </Container>
    );
  }

  return (
    <Container borderTop="primary" padding={{zero: 'xs lg', xl: 'md 2xl xl lg'}}>
      <StyledClippedBox clipHeight={CLIPPED_HEIGHT}>
        <Stack gap="md">
          <Flex align="center" justify="between" gap="md" wrap="wrap" paddingLeft="sm">
            <Text as="div" size="md">
              {t('Registers')}
            </Text>
            {formatControl}
          </Flex>
          {registerGrid}
        </Stack>
      </StyledClippedBox>
    </Container>
  );
}

const StyledClippedBox = styled(ClippedBox)`
  padding: ${p => p.theme.space.sm} 0;
`;
