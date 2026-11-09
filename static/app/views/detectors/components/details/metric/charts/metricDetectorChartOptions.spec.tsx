import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {GroupOpenPeriodFixture} from 'sentry-fixture/groupOpenPeriod';
import {ThemeFixture} from 'sentry-fixture/theme';

import type {GroupOpenPeriod} from 'sentry/types/group';

import {getMetricDetectorChartOption} from './metricDetectorChartOptions';

const theme = ThemeFixture();

function getIncidentLineLabel(openPeriod: GroupOpenPeriod) {
  const {chartOption} = getMetricDetectorChartOption(
    {
      detector: MetricDetectorFixture(),
      timeseriesData: [
        {
          seriesName: 'count()',
          data: [
            {name: new Date('2024-01-01T00:00:00Z').getTime(), value: 1},
            {name: new Date('2024-01-01T00:10:00Z').getTime(), value: 2},
          ],
        },
      ],
      openPeriods: [openPeriod],
    },
    theme
  );

  const incidentSeries = chartOption.series.find(s => s.seriesName === 'Incident Line');
  return incidentSeries?.markLine?.label;
}

describe('getMetricDetectorChartOption', () => {
  it('labels open periods with the issue short ID', () => {
    const label = getIncidentLineLabel(GroupOpenPeriodFixture({shortId: 'PROJ-1A'}));

    expect(label).toEqual(expect.objectContaining({show: true, formatter: 'PROJ-1A'}));
  });

  it('hides the label when the open period has no short ID', () => {
    const label = getIncidentLineLabel(GroupOpenPeriodFixture({shortId: null}));

    expect(label).toEqual(expect.objectContaining({show: false}));
  });
});
