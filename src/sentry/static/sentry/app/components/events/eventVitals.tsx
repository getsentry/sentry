import React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import {Panel} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconFire, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Event} from 'app/types/event';
import {formattedValue} from 'app/utils/measurements/index';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {IconSize} from 'app/utils/theme';

type Props = {
  event: Event;
  showSectionHeader?: boolean;
};

function isOutdatedSdk(event: Event): boolean {
  if (!event.sdk?.version) {
    return false;
  }

  const sdkVersion = event.sdk.version;
  return (
    sdkVersion.startsWith('5.26.') ||
    sdkVersion.startsWith('5.27.0') ||
    sdkVersion.startsWith('5.27.1') ||
    sdkVersion.startsWith('5.27.2')
  );
}

export default function EventVitals({event, showSectionHeader = true}: Props) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => {
      // ignore marker measurements
      return !name.startsWith('mark.');
    })
    .sort();

  if (measurementNames.length === 0) {
    return null;
  }

  const component = (
    <Measurements>
      {measurementNames.map(name => (
        <EventVital key={name} event={event} name={name} />
      ))}
    </Measurements>
  );

  if (showSectionHeader) {
    return (
      <Container>
        <SectionHeading>
          {t('Web Vitals')}
          {isOutdatedSdk(event) && (
            <WarningIconContainer size="sm">
              <Tooltip
                title={t(
                  'These vitals were collected using an outdated SDK version and may not be accurate. To ensure accurate web vitals in new transaction events, please update your SDK to the latest version.'
                )}
                position="top"
                containerDisplayMode="inline-block"
              >
                <IconWarning size="sm" />
              </Tooltip>
            </WarningIconContainer>
          )}
        </SectionHeading>
        {component}
      </Container>
    );
  }

  return component;
}

type EventVitalProps = Props & {
  name: string;
};

function EventVital({event, name}: EventVitalProps) {
  const value = event.measurements?.[name].value ?? null;
  if (value === null) {
    return null;
  }

  const record = WEB_VITAL_DETAILS[`measurements.${name}`];

  if (!record) {
    return null;
  }

  const failedThreshold = value >= record.poorThreshold;

  const currentValue = formattedValue(record, value);
  const thresholdValue = formattedValue(record, record?.poorThreshold ?? 0);

  return (
    <EventVitalContainer>
      <StyledPanel failedThreshold={failedThreshold}>
        <Name>{name}</Name>
        <ValueRow>
          {failedThreshold ? (
            <FireIconContainer size="sm">
              <Tooltip
                title={t('Fails threshold at %s.', thresholdValue)}
                position="top"
                containerDisplayMode="inline-block"
              >
                <IconFire size="sm" />
              </Tooltip>
            </FireIconContainer>
          ) : null}
          <Value failedThreshold={failedThreshold}>{currentValue}</Value>
        </ValueRow>
      </StyledPanel>
    </EventVitalContainer>
  );
}

const Measurements = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
`;

const Container = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const StyledPanel = styled(Panel)<{failedThreshold: boolean}>`
  padding: ${space(1)} ${space(1.5)};
  margin-bottom: ${space(1)};
  ${p => p.failedThreshold && `border: 1px solid ${p.theme.red300};`}
`;

const Name = styled('div')``;

const ValueRow = styled('div')`
  display: flex;
  align-items: center;
`;

const WarningIconContainer = styled('span')<{size: IconSize | string}>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  line-height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  margin-left: ${space(0.5)};
  color: ${p => p.theme.red300};
`;

const FireIconContainer = styled('span')<{size: IconSize | string}>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  line-height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  margin-right: ${space(0.5)};
  color: ${p => p.theme.red300};
`;

const Value = styled('span')<{failedThreshold: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.failedThreshold && `color: ${p.theme.red300};`}
`;

export const EventVitalContainer = styled('div')``;
