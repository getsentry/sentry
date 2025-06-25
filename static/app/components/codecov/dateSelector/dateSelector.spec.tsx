import {render, screen} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {DateSelector} from 'sentry/components/codecov/dateSelector/dateSelector';

describe('DateSelector', function () {
  it('renders when given relative period', async function () {
    render(
      <CodecovQueryParamsProvider>
        <DateSelector />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/codecov/tests',
            query: {
              codecovPeriod: '7d',
              integratedOrg: 'some-org-name',
              repository: 'some-repository',
            },
          },
        },
      }
    );
    expect(await screen.findByRole('button', {name: '7D'})).toBeInTheDocument();
  });

  it('renders when given an invalid relative period', async function () {
    render(
      <CodecovQueryParamsProvider>
        <DateSelector />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/codecov/tests',
            query: {
              codecovPeriod: '1y',
              integratedOrg: 'some-org-name',
              repository: 'some-repository',
            },
          },
        },
      }
    );
    expect(
      await screen.findByRole('button', {name: 'Invalid Period'})
    ).toBeInTheDocument();
  });
});
