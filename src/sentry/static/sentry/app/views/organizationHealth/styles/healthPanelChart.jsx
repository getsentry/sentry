import styled, {css} from 'react-emotion';

import PanelChart from 'app/components/charts/panelChart';
import space from 'app/styles/space';

const chartMarginCss = css`
  margin-right: ${space(2)};
  &:last-child {
    margin-right: 0;
  }
`;

const HealthPanelChart = styled(PanelChart)`
  ${chartMarginCss};
  flex-shrink: 0;
  overflow: hidden;
`;
export default HealthPanelChart;
