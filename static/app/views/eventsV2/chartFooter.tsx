import * as React from 'react';

import Feature from 'sentry/components/acl/feature';
import OptionCheckboxSelector from 'sentry/components/charts/optionCheckboxSelector';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import {t} from 'sentry/locale';
import {Organization, SelectValue} from 'sentry/types';
import {TOP_EVENT_MODES} from 'sentry/utils/discover/types';

type Props = {
  organization: Organization;
  total: number | null;
  yAxisValue: string[];
  yAxisOptions: SelectValue<string>[];
  onAxisChange: (value: string[]) => void;
  displayMode: string;
  displayOptions: SelectValue<string>[];
  onDisplayChange: (value: string) => void;
  onTopEventsChange: (value: string) => void;
  topEvents: string;
};

export default function ChartFooter({
  organization,
  total,
  yAxisValue,
  yAxisOptions,
  onAxisChange,
  displayMode,
  displayOptions,
  onDisplayChange,
  onTopEventsChange,
  topEvents,
}: Props) {
  const elements: React.ReactNode[] = [];

  elements.push(<SectionHeading key="total-label">{t('Total Events')}</SectionHeading>);
  elements.push(
    total === null ? (
      <SectionValue data-test-id="loading-placeholder" key="total-value">
        &mdash;
      </SectionValue>
    ) : (
      <SectionValue key="total-value">{total.toLocaleString()}</SectionValue>
    )
  );
  const topEventOptions: SelectValue<string>[] = [];
  for (let i = 1; i <= 10; i++) {
    topEventOptions.push({value: i.toString(), label: i.toString()});
  }

  return (
    <ChartControls>
      <InlineContainer>{elements}</InlineContainer>
      <InlineContainer>
        <OptionSelector
          title={t('Display')}
          selected={displayMode}
          options={displayOptions}
          onChange={onDisplayChange}
          menuWidth="170px"
        />
        <Feature organization={organization} features={['discover-top-events']}>
          {({hasFeature}) => {
            if (hasFeature && TOP_EVENT_MODES.includes(displayMode)) {
              return (
                <OptionSelector
                  title={t('Limit')}
                  selected={topEvents}
                  options={topEventOptions}
                  onChange={onTopEventsChange}
                  menuWidth="60px"
                  featureType="new"
                />
              );
            }
            return null;
          }}
        </Feature>
        <Feature
          organization={organization}
          features={['connect-discover-and-dashboards']}
        >
          {({hasFeature}) => {
            if (hasFeature) {
              return (
                <OptionCheckboxSelector
                  title={t('Y-Axis')}
                  selected={yAxisValue}
                  options={yAxisOptions}
                  onChange={onAxisChange}
                />
              );
            }
            return (
              <OptionSelector
                title={t('Y-Axis')}
                selected={yAxisValue[0]}
                options={yAxisOptions}
                onChange={value => onAxisChange([value])}
              />
            );
          }}
        </Feature>
      </InlineContainer>
    </ChartControls>
  );
}
