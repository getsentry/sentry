import {vi} from 'vitest';

import {render} from 'sentry-test/reactTestingLibrary';

import BaseChart from 'sentry/components/charts/baseChart';

vi.mock('echarts-for-react/lib/core', async () => {
  // We need to do this because `vi.mock` gets hoisted by babel and `React` is not
  // guaranteed to be in scope
  const ReactActual = await vi.importActual<typeof import('react')>('react');

  // We need a class component here because `BaseChart` passes `ref` which will
  // error if we return a stateless/functional component
  return {
    default: class extends ReactActual.Component {
      render() {
        // ReactEchartsCore accepts a style prop that determines height
        return <div style={{...this.props.style, background: 'green'}}>echarts mock</div>;
      }
    },
  };
});

function TestContainer({children}: {children: React.ReactNode}) {
  return (
    <div style={{height: '500px', background: 'yellow', padding: '20px'}}>{children}</div>
  );
}

describe('BaseChart', function () {
  it('can scale to full parent height when given autoHeightResize', () => {
    render(
      <TestContainer>
        <BaseChart autoHeightResize />
      </TestContainer>
    );
  });

  it('renders with default height when autoHeightResize not provided', () => {
    render(
      <TestContainer>
        <BaseChart />
      </TestContainer>
    );
  });
});
