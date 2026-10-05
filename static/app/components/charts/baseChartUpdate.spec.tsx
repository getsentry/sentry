import ReactEchartsCore from 'echarts-for-react/lib/core';

import {render} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';

const mockShouldSetOptionResults: boolean[] = [];

jest.mock('echarts-for-react/lib/core', () => {
  const ReactActual = require('react');

  return class extends ReactActual.Component {
    componentDidUpdate(prevProps: unknown) {
      mockShouldSetOptionResults.push(this.props.shouldSetOption(prevProps, this.props));
    }

    getEchartsInstance() {
      return {isDisposed: () => false};
    }

    render() {
      return null;
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

  it('passes the chart instance to a new ref when the ref changes', () => {
    const firstRef = jest.fn();
    const secondRef = jest.fn();
    const {rerender} = render(<BaseChart ref={firstRef} series={[]} />);

    rerender(<BaseChart ref={secondRef} series={[]} />);

    expect(firstRef.mock.calls).toEqual([[expect.any(ReactEchartsCore)], [null]]);
    expect(secondRef.mock.calls).toEqual([[expect.any(ReactEchartsCore)]]);
  });
});
