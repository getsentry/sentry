import * as React from 'react';

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
        {TOP_EVENT_MODES.includes(displayMode) && (
          <OptionSelector
            title={t('Limit')}
            selected={topEvents}
            options={topEventOptions}
            onChange={onTopEventsChange}
            menuWidth="60px"
          />
        )}
        <OptionCheckboxSelector
          title={t('Y-Axis')}
          selected={yAxisValue}
          options={yAxisOptions}
          onChange={onAxisChange}
        />
      </InlineContainer>
    </ChartControls>
  );
}
