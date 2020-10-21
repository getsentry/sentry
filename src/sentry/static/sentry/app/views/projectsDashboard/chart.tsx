import {Project} from 'app/types';
import {Series} from 'app/types/echarts';
import {t} from 'app/locale';
import MiniBarChart from 'app/components/charts/miniBarChart';

type Props = {
  stats: Required<Project>['stats'];
};

const Chart = ({stats = []}: Props) => {
  const series: Series[] = [
    {
      seriesName: t('Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
    },
  ];
  return <MiniBarChart isGroupedByDate showTimeInTooltip series={series} height={60} />;
};

export default Chart;
