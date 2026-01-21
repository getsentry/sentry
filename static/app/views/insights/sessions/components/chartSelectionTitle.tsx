import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {space} from 'sentry/styles/space';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useChartPlacementContext} from 'sentry/views/insights/sessions/components/chartPlacement';

interface Props {
  /**
   * `title` is required so we can render a name even if ChartPlacementContext
   * is not in use.
   */
  title: string;
}

export default function ChartSelectionTitle({title}: Props) {
  const {chartName, chartOptions, onChange} = useChartPlacementContext();

  if (!chartName) {
    return <Widget.WidgetTitle title={title} />;
  }
  return (
    <StyledCompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} borderless size="zero" />
      )}
      offset={4}
      options={chartOptions}
      value={chartName}
      onChange={selection => {
        onChange(selection as (typeof chartOptions)[number]);
      }}
    />
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  /* Reset font-weight set by HeaderTitleLegend, buttons are already bold and
   * setting this higher up causes it to trickle into the menus */
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: -${space(0.5)} -${space(1)} -${space(0.25)};
  min-width: 0;

  button {
    padding: ${space(0.5)} ${space(1)};
    font-size: ${p => p.theme.fontSize.lg};
  }
`;
