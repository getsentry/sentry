const data = [
  [1543276800000, 0],
  [1543363200000, 0],
  [1543449600000, 36],
  [1543536000000, 40],
  [1543622400000, 0],
  [1543708800000, 17],
  [1543795200000, 104],
  [1543881600000, 13],
];
const model = {
  xAxis: [
    {
      rangeStart: 1543449600000,
      rangeEnd: 1543708800000,
    },
  ],
  series: [
    {
      data,
    },
  ],
};

export const chart = {
  getModel: jest.fn(() => ({option: model})),
};

// eslint-disable-next-line
export const doZoom = (wrapper, chart = chart) => {
  wrapper.find('ChartZoom').instance().handleDataZoom({}, chart);
  wrapper.find('ChartZoom').instance().handleChartFinished();
};

export const mockZoomRange = (rangeStart, rangeEnd) => {
  chart.getModel.mockImplementation(() => ({
    option: {
      ...model,
      xAxis: [
        {
          rangeStart,
          rangeEnd,
        },
      ],
    },
  }));
};
