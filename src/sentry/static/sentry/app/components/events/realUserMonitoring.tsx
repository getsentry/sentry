import React from 'react';
import styled from '@emotion/styled';

import {Organization, Event} from 'app/types';
import {IconSize} from 'app/utils/theme';
import {t} from 'app/locale';
import {SectionHeading} from 'app/components/charts/styles';
import {Panel} from 'app/components/panels';
import {getDuration} from 'app/utils/formatters';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import {IconFire} from 'app/icons';
import {WEB_VITAL_DETAILS} from 'app/views/performance/realUserMonitoring/constants';

// translate known short form names into their long forms
const LONG_MEASUREMENT_NAMES = {
  fid: 'First Input Delay',
  fp: 'First Paint',
  fcp: 'First Contentful Paint',
  lcp: 'Largest Contentful Paint',
};

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

  renderMeasurements() {
    const {event} = this.props;

    if (!event.measurements) {
      return null;
    }

    const measurementNames = Object.keys(event.measurements)
      .filter(name => {
        // ignore marker measurements
        return !name.startsWith('mark.');
      })
      .sort();

    return measurementNames.map(name => {
      const value = event.measurements![name].value;

      const record = Object.values(WEB_VITAL_DETAILS).find(vital => vital.slug === name);

      const failedThreshold = record ? value >= record.failureThreshold : false;

      return (
        <div key={name}>
          <StyledPanel failedThreshold={failedThreshold}>
            <Name>{LONG_MEASUREMENT_NAMES[name] ?? name}</Name>
            <ValueRow>
              {failedThreshold ? (
                <WarningIconContainer size="sm">
                  <Tooltip
                    title={`${getDuration(value / 1000, 3)} >= ${getDuration(
                      record!.failureThreshold / 1000,
                      3
                    )}`}
                    position="top"
                    containerDisplayMode="inline-block"
                  >
                    <IconFire size="sm" />
                  </Tooltip>
                </WarningIconContainer>
              ) : null}
              <Value failedThreshold={failedThreshold}>
                {getDuration(value / 1000, 3)}
              </Value>
            </ValueRow>
          </StyledPanel>
        </div>
      );
    });
  }

  render() {
    const {organization} = this.props;

    if (!organization.features.includes('measurements') || !this.hasMeasurements()) {
      return null;
    }

    return (
      <Container>
        <SectionHeading>{t('Web Vitals')}</SectionHeading>
        <Measurements>{this.renderMeasurements()}</Measurements>
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

const StyledPanel = styled(Panel)<{failedThreshold: boolean}>`
  padding: ${space(1)};
  margin-bottom: ${space(1)};

  ${p => {
    if (!p.failedThreshold) {
      return null;
    }

    return `
      border: 1px solid ${p.theme.red400};
    `;
  }};
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
  margin-right: ${space(1)};
  color: ${p => p.theme.red400};
`;

const Value = styled('span')<{failedThreshold: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => {
    if (!p.failedThreshold) {
      return null;
    }

    return `
      color: ${p.theme.red400};
    `;
  }};
`;

export default RealUserMonitoring;
