import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import BaseChart from 'sentry/components/charts/baseChart';

jest.mock('echarts-for-react/lib/core', () => {
  // We need to do this because `jest.mock` gets hoisted by babel and `React` is not
  // guaranteed to be in scope
  const ReactActual = require('react');

  // We need a class component here because `BaseChart` passes `ref` which will
  // error if we return a stateless/functional component
  return class extends ReactActual.Component {
    render() {
      // ReactEchartsCore accepts a style prop that determines height
      return <div style={{...this.props.style, background: 'green'}}>echarts mock</div>;
    }
  };
});

const TestContainer = ({children}) => (
  <div style={{height: '500px', background: 'yellow', padding: '20px'}}>{children}</div>
);

describe('BaseChart', function () {
  const {routerContext} = initializeOrg();
  it('can scale to full parent height when given autoHeightResize', async () => {
    const wrapper = mountWithTheme(
      <TestContainer>
        <BaseChart autoHeightResize />
      </TestContainer>,
      routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper).toSnapshot();
  });

  it('renders with default height when autoHeightResize not provided', async () => {
    const wrapper = mountWithTheme(
      <TestContainer>
        <BaseChart />
      </TestContainer>,
      routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper).toSnapshot();
  });
});
