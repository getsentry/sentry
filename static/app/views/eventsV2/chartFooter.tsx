import * as React from 'react';

import Feature from 'app/components/acl/feature';
import OptionCheckboxSelector from 'app/components/charts/optionCheckboxSelector';
import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {t} from 'app/locale';
import {Organization, SelectValue} from 'app/types';

type Props = {
  organization: Organization;
  total: number | null;
  yAxisValue: string[];
  yAxisOptions: SelectValue<string>[];
  onAxisChange: (value: string[]) => void;
  displayMode: string;
  displayOptions: SelectValue<string>[];
  onDisplayChange: (value: string) => void;
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
            } else {
              return (
                <OptionSelector
                  title={t('Y-Axis')}
                  selected={yAxisValue[0]}
                  options={yAxisOptions}
                  onChange={value => onAxisChange([value])}
                />
              );
            }
          }}
        </Feature>
      </InlineContainer>
    </ChartControls>
  );
}
