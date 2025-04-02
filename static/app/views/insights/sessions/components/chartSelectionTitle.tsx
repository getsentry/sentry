import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {space} from 'sentry/styles/space';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {
  MISSING_CONTEXT_PROVIDER,
  useChartPlacementContext,
} from 'sentry/views/insights/sessions/components/chartPlacementContext';
import {useInsightLayoutContext} from 'sentry/views/insights/sessions/components/insightLayoutContext';

interface Props {
  title: string;
}

export default function ChartSelectionTitle({title}: Props) {
  const {chartsByIndex, chartOptions, onChange} = useInsightLayoutContext();
  const {index} = useChartPlacementContext();

  if (index === MISSING_CONTEXT_PROVIDER) {
    return <Widget.WidgetTitle title={title} />;
  }
  return (
    <StyledCompactSelect
      triggerProps={{borderless: true, size: 'zero'}}
      offset={4}
      options={chartOptions}
      value={chartsByIndex[index]}
      onChange={selection => {
        onChange(index, selection as (typeof chartOptions)[number]);
      }}
    />
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  /* Reset font-weight set by HeaderTitleLegend, buttons are already bold and
   * setting this higher up causes it to trickle into the menus */
  font-weight: ${p => p.theme.fontWeightNormal};
  margin: -${space(0.5)} -${space(1)} -${space(0.25)};
  min-width: 0;

  button {
    padding: ${space(0.5)} ${space(1)};
    font-size: ${p => p.theme.fontSizeLarge};
  }
`;
