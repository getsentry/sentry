import styled from '@emotion/styled';
import {Location} from 'history';

import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';

import {PerformanceLayoutBodyRow} from '../../layouts';

import MiniChartContainer, {ChartSettingType} from './miniChartContainer';

export type ChartRowProps = {
  eventView: EventView;
  location: Location;
};

const MiniChartRow = (props: ChartRowProps) => {
  return (
    <StyledRow minSize={200}>
      {new Array(3).fill(0).map((_, index) => (
        <MiniChartContainer
          {...props}
          key={index}
          index={index}
          defaultChartSetting={ChartSettingType.LCP_HISTOGRAM}
        />
      ))}
    </StyledRow>
  );
};

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

export default MiniChartRow;
