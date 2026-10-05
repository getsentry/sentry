import type {EChartsOption} from 'echarts';

import {render} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';

const mockSetOption = jest.fn();
const mockInstance = {
  isDisposed: () => false,
  setOption: mockSetOption,
};

jest.mock('echarts/core', () => ({
  __esModule: true,
  connect: () => {},
  disconnect: () => {},
  use: () => {},
  getInstanceByDom: (element: HTMLElement) =>
    element.classList.contains('echarts-for-react') ? mockInstance : undefined,
}));

jest.mock('echarts-for-react/lib/core', () => {
  // We need to do this because `jest.mock` gets hoisted before imports and `React` is not
  // guaranteed to be in scope
  const ReactActual = require('react');

  // Mirrors the parts of echarts-for-react's update lifecycle that BaseChart relies on
  return class extends ReactActual.Component {
    getEchartsInstance() {
      return mockInstance;
    }

    componentDidUpdate() {
      if (this.props.shouldSetOption && !this.props.shouldSetOption()) {
        return;
      }
      mockInstance.setOption(this.props.option);
    }

    render() {
      return <div className="echarts-for-react" />;
    }
  };
});

function getLastSeriesType() {
  const option: EChartsOption = mockSetOption.mock.calls.at(-1)?.[0];
  return Array.isArray(option?.series) ? option.series[0]?.type : undefined;
}

describe('BaseChart option updates', () => {
  beforeEach(() => {
    mockSetOption.mockClear();
  });

  it('applies option updates when the ref callback changes identity', () => {
    const {rerender} = render(
      <BaseChart
        // A new callback ref on each render, like a parent whose ref callback
        // depends on the series being plotted
        ref={() => {}}
        series={[{type: 'line', data: [[1, 1]]}]}
      />
    );

    rerender(<BaseChart ref={() => {}} series={[{type: 'bar', data: [[1, 1]]}]} />);

    expect(mockSetOption).toHaveBeenCalled();
    expect(getLastSeriesType()).toBe('bar');
  });
});
