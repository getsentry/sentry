import {render} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';

const mockShouldSetOptionResults: boolean[] = [];

jest.mock('echarts/core', () => ({
  ...jest.requireActual('echarts/core'),
  getInstanceByDom: (dom: HTMLElement | null) =>
    dom ? {isDisposed: () => false} : undefined,
}));

jest.mock('echarts-for-react/lib/core', () => {
  const ReactActual = require('react');

  return class extends ReactActual.Component {
    ele: HTMLDivElement | null = null;

    componentDidUpdate(prevProps: unknown) {
      mockShouldSetOptionResults.push(this.props.shouldSetOption(prevProps, this.props));
    }

    getEchartsInstance() {
      return require('echarts/core').getInstanceByDom(this.ele);
    }

    render() {
      return (
        <div
          className="echarts-for-react"
          ref={(ele: HTMLDivElement | null) => {
            this.ele = ele;
          }}
        />
      );
    }
  };
});

describe('BaseChart', () => {
  beforeEach(() => {
    mockShouldSetOptionResults.length = 0;
  });

  it('applies updated options when the chart ref changes on every render', () => {
    const {rerender} = render(<BaseChart ref={() => {}} series={[]} />);

    rerender(<BaseChart ref={() => {}} series={[{type: 'bar', data: [[1, 2]]}]} />);

    expect(mockShouldSetOptionResults).toEqual([true]);
  });
});
