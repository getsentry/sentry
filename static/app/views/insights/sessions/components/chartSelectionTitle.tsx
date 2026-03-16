import styled from '@emotion/styled';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useChartPlacementContext} from 'sentry/views/insights/sessions/components/chartPlacement';

interface Props {
  /**
   * `title` is required so we can render a name even if ChartPlacementContext
   * is not in use.
   */
  title: string;
}

export function ChartSelectionTitle({title}: Props) {
  const {chartName, chartOptions, onChange} = useChartPlacementContext();

  if (!chartName) {
    return <Widget.WidgetTitle title={title} />;
  }
  return (
    <StyledCompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} priority="transparent" size="zero" />
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
  font-weight: ${p => p.theme.font.weight.sans.regular};
  margin: -${p => p.theme.space.xs} -${p => p.theme.space.md} -${p =>
      p.theme.space['2xs']};
  min-width: 0;

  button {
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
    font-size: ${p => p.theme.font.size.lg};
  }
`;
