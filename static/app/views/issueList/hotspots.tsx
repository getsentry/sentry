import {AreaChart} from 'sentry/components/charts/areaChart';
import * as Layout from 'sentry/components/layouts/thirds';

type Props = {};

function IssueHotSpots({}: Props) {
  const TOTAL = 6;
  const NOW = new Date().getTime();
  const getValue = () => Math.round(Math.random() * 1000);
  const getDate = num => NOW - (TOTAL - num) * 86400000;
  const getData = num =>
    [...Array(num)].map((_v, i) => ({value: getValue(), name: getDate(i)}));

  return (
    <Layout.HotSpots noActionWrap>
      <p>Put the HotSpots here!</p>
      <AreaChart
        style={{height: 250}}
        series={[
          {
            seriesName: 'Handled',
            data: getData(7),
          },
          {
            seriesName: 'Unhandled',
            data: getData(7),
          },
        ]}
        previousPeriod={[
          {
            seriesName: 'Previous',
            data: getData(7),
          },
        ]}
      />
    </Layout.HotSpots>
  );
}

export default IssueHotSpots;
