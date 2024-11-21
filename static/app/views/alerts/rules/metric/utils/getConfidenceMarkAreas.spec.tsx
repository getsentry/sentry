import type {Series} from 'sentry/types/echarts';
import theme from 'sentry/utils/theme';
import {getConfidenceMarkAreas} from 'sentry/views/alerts/rules/metric/utils/getConfidenceMarkAreas';

describe('getConfidenceMarkAreas', () => {
  it('creates mark areas for high and low confidence', () => {
    const data: Series[] = [
      {
        data: [
          {name: '1731556800', confidence: 'HIGH', value: 0},
          {name: '1731560400', confidence: 'HIGH', value: 0},
          {name: '1731567600', confidence: 'LOW', value: 0},
          {name: '1731571200', confidence: 'LOW', value: 0},
        ],
        seriesName: '',
      },
    ];
    expect(getConfidenceMarkAreas(data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          markArea: {
            data: [[{xAxis: 1731556800}, {xAxis: 1731567600}]],
            itemStyle: {color: theme.green300, opacity: 0.1},
            silent: true,
          },
        }),
        expect.objectContaining({
          markArea: {
            data: [[{xAxis: 1731567600}, {xAxis: 1731571200}]],
            itemStyle: {color: theme.red300, opacity: 0.1},
            silent: true,
          },
        }),
      ])
    );
  });
});
