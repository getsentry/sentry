import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {formattedValue} from 'sentry/utils/measurements/index';
import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'sentry/utils/performance/vitals/constants';
import type {Vital} from 'sentry/utils/performance/vitals/types';
import type {IconSize} from 'sentry/utils/theme';

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

type Props = {
  event: Event;
};

export default function EventVitals({event}: Props) {
  return (
    <Fragment>
      <WebVitals event={event} />
      <MobileVitals event={event} />
    </Fragment>
  );
}

function WebVitals({event}: Props) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
    .sort();

  if (measurementNames.length === 0) {
    return null;
  }

  return (
    <Container>
      <SectionHeading>
        {t('Web Vitals')}
        {isOutdatedSdk(event) && (
          <WarningIconContainer data-test-id="outdated-sdk-warning" size="sm">
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
      <Measurements>
        {measurementNames.map(name => {
          // Measurements are referred to by their full name `measurements.<name>`
          // here but are stored using their abbreviated name `<name>`. Make sure
          // to convert it appropriately.
          const measurement = `measurements.${name}`;
          const vital = WEB_VITAL_DETAILS[measurement];

          return <EventVital key={name} event={event} name={name} vital={vital} />;
        })}
      </Measurements>
    </Container>
  );
}

function MobileVitals({event}: Props) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => Boolean(MOBILE_VITAL_DETAILS[`measurements.${name}`]))
    .sort();

  if (measurementNames.length === 0) {
    return null;
  }

  return (
    <Container>
      <SectionHeading>{t('Mobile Vitals')}</SectionHeading>
      <Measurements>
        {measurementNames.map(name => {
          // Measurements are referred to by their full name `measurements.<name>`
          // here but are stored using their abbreviated name `<name>`. Make sure
          // to convert it appropriately.
          const measurement = `measurements.${name}`;
          const vital = MOBILE_VITAL_DETAILS[measurement];

          return <EventVital key={name} event={event} name={name} vital={vital} />;
        })}
      </Measurements>
    </Container>
  );
}

interface EventVitalProps extends Props {
  name: string;
  vital?: Vital;
}

function EventVital({event, name, vital}: EventVitalProps) {
  const value = event.measurements?.[name]!.value ?? null;
  if (value === null || !vital) {
    return null;
  }

  const failedThreshold = defined(vital.poorThreshold) && value >= vital.poorThreshold;

  const currentValue = formattedValue(vital, value);
  const thresholdValue = formattedValue(vital, vital?.poorThreshold ?? 0);

  return (
    <EventVitalContainer>
      <StyledPanel failedThreshold={failedThreshold}>
        <Name>{vital.name ?? name}</Name>
        <ValueRow>
          {failedThreshold ? (
            <FireIconContainer data-test-id="threshold-failed-warning" size="sm">
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
  color: ${p => p.theme.errorText};
`;

const FireIconContainer = styled('span')<{size: IconSize | string}>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  line-height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  margin-right: ${space(0.5)};
  color: ${p => p.theme.errorText};
`;

const Value = styled('span')<{failedThreshold: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.failedThreshold && `color: ${p.theme.errorText};`}
`;

export const EventVitalContainer = styled('div')``;
