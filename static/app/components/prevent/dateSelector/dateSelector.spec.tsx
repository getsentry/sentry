import {render, screen} from 'sentry-test/reactTestingLibrary';

import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import {DateSelector} from 'sentry/components/prevent/dateSelector/dateSelector';

describe('DateSelector', () => {
  it('renders when given relative period', async () => {
    render(
      <PreventQueryParamsProvider>
        <DateSelector />
      </PreventQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tests',
            query: {
              preventPeriod: '7d',
              integratedOrgId: '123',
              repository: 'some-repository',
            },
          },
        },
      }
    );
    expect(await screen.findByRole('button', {name: '7D'})).toBeInTheDocument();
  });

  it('renders when given an invalid relative period', async () => {
    render(
      <PreventQueryParamsProvider>
        <DateSelector />
      </PreventQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tests',
            query: {
              preventPeriod: '1y',
              integratedOrgId: '123',
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
