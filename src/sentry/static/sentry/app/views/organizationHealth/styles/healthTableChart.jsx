import styled from 'react-emotion';

import TableChart from 'app/components/charts/tableChart';

import chartMargin from './chartMargin';

const HealthPanelChart = styled(TableChart)`
  ${chartMargin};
  flex-shrink: 0;
  overflow: hidden;
`;
export default HealthPanelChart;
