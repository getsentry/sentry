import styled from 'react-emotion';

import PanelChart from 'app/components/charts/panelChart';

import chartMargin from './chartMargin';

const HealthPanelChart = styled(PanelChart)`
  ${chartMargin};
  flex-shrink: 0;
  overflow: hidden;
`;
export default HealthPanelChart;
