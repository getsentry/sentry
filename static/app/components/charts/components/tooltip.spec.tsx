import type {CallbackDataParams} from 'echarts/types/dist/shared';

import {getFormatter} from 'sentry/components/charts/components/tooltip';

const TIMESTAMP = 1_700_000_000_000;

function seriesParam(seriesName: string, value: number): CallbackDataParams {
  return {
    seriesName,
    data: [TIMESTAMP, value],
    value: [TIMESTAMP, value],
    marker: '',
  } as CallbackDataParams;
}

function renderedSeriesNames(html: string): string[] {
  const container = document.createElement('div');
  container.innerHTML = html;
  return Array.from(container.querySelectorAll('.tooltip-series .tooltip-label')).map(
    label => label.textContent?.trim() ?? ''
  );
}

describe('getFormatter', () => {
  const params = [
    seriesParam('zero', 0),
    seriesParam('low', 1),
    seriesParam('high', 30),
    seriesParam('negative', -5),
    seriesParam('mid', 10),
  ];

  it('keeps the series order without a limit', () => {
    const formatter = getFormatter({isGroupedByDate: true, showTimeInTooltip: true});
    expect(renderedSeriesNames(formatter(params, '') as string)).toEqual([
      'zero',
      'low',
      'high',
      'negative',
      'mid',
    ]);
  });

  it('lists the highest values first and zeros last', () => {
    const formatter = getFormatter({
      isGroupedByDate: true,
      showTimeInTooltip: true,
      limit: 10,
    });
    expect(renderedSeriesNames(formatter(params, '') as string)).toEqual([
      'high',
      'mid',
      'low',
      'negative',
      'zero',
    ]);
  });

  it('drops the lowest values and zeros past the limit', () => {
    const formatter = getFormatter({
      isGroupedByDate: true,
      showTimeInTooltip: true,
      limit: 3,
    });
    expect(renderedSeriesNames(formatter(params, '') as string)).toEqual([
      'high',
      'mid',
      'low',
      '+2 more',
    ]);
  });

  it('does not pass the "+X more" row to the formatters', () => {
    const valueFormatter = jest.fn(String);
    const nameFormatter = jest.fn((name: string) => name);
    const formatter = getFormatter({
      isGroupedByDate: true,
      showTimeInTooltip: true,
      limit: 1,
      valueFormatter,
      nameFormatter,
    });
    formatter(params, '');
    expect(nameFormatter.mock.calls.map(([name]) => name)).toEqual(['high']);
    expect(valueFormatter).toHaveBeenCalledTimes(1);
  });
});
