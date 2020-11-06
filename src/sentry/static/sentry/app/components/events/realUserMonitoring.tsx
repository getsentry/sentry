import React from 'react';
import styled from '@emotion/styled';

import {Organization, Event} from 'app/types';
import {IconSize} from 'app/utils/theme';
import {t} from 'app/locale';
import {SectionHeading} from 'app/components/charts/styles';
import {Panel} from 'app/components/panels';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import {IconFire} from 'app/icons';
import {WEB_VITAL_DETAILS} from 'app/views/performance/transactionVitals/constants';
import {isTrustworthyVital} from 'app/views/performance/transactionVitals/utils';
import {formattedValue} from 'app/utils/measurements/index';

type Props = {
  organization: Organization;
  event: Event;
};

class RealUserMonitoring extends React.Component<Props> {
  hasMeasurements() {
    const {event} = this.props;

    if (!event.measurements) {
      return false;
    }

    return Object.keys(event.measurements).length > 0;
  }

  getDisplayableMeasurements(event) {
    const {measurements = {}} = event;

    return Object.keys(measurements)
      .filter(name => !name.startsWith('mark.'))
      .filter(vitalName => {
        const markName = `mark.${vitalName}`;
        if (!measurements.hasOwnProperty(markName)) {
          // These measurements do not have a corresponding mark,
          // so just let them through
          return true;
        }
        return isTrustworthyVital(event, vitalName, true);
      })
      .sort();
  }

  renderMeasurement(measurement, {value}) {
    const record = Object.values(WEB_VITAL_DETAILS).find(
      vital => vital.slug === measurement
    );
    if (record === undefined) {
      return null;
    }

    const {name, failureThreshold} = record;
    const failed = value >= failureThreshold;
    const currentValue = formattedValue(record, value);
    const thresholdValue = formattedValue(record, failureThreshold);

    return (
      <StyledPanel failed={failed}>
        <Name>{name}</Name>
        <ValueRow>
          {failed ? (
            <WarningIconContainer size="sm">
              <Tooltip
                title={t('Fails threshold at %s.', thresholdValue)}
                position="top"
                containerDisplayMode="inline-block"
              >
                <IconFire size="sm" />
              </Tooltip>
            </WarningIconContainer>
          ) : null}
          <Value failed={failed}>{currentValue}</Value>
        </ValueRow>
      </StyledPanel>
    );
  }

  render() {
    const {organization, event} = this.props;

    if (!organization.features.includes('measurements')) {
      return null;
    }

    const measurements = this.getDisplayableMeasurements(event);

    if (measurements.length <= 0) {
      return null;
    }

    return (
      <Container>
        <SectionHeading>{t('Web Vitals')}</SectionHeading>
        <Measurements>
          {measurements.map(name => (
            <div key={name}>
              {this.renderMeasurement(name, event.measurements![name])}
            </div>
          ))}
        </Measurements>
      </Container>
    );
  }
}

const Measurements = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
`;

const Container = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const StyledPanel = styled(Panel)<{failed: boolean}>`
  padding: ${space(1)} ${space(1.5)};
  margin-bottom: ${space(1)};
  ${p => p.failed && `border: 1px solid ${p.theme.red300};`}
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
  margin-right: ${space(0.5)};
  color: ${p => p.theme.red300};
`;

const Value = styled('span')<{failed: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.failed && `color: ${p.theme.red300};`}
`;

export default RealUserMonitoring;
