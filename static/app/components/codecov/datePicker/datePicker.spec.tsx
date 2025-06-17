import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {DatePicker} from 'sentry/components/codecov/datePicker/datePicker';

describe('DatePicker', function () {
  it('can change period', async function () {
    const {router} = render(
      <CodecovQueryParamsProvider>
        <DatePicker />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/codecov/tests',
            query: {codecovPeriod: '7d'},
          },
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: '7D', expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Last 30 days'}));

    expect(router.location.search).toBe('?codecovPeriod=30d');

    expect(
      screen.getByRole('button', {name: '30D', expanded: false})
    ).toBeInTheDocument();
  });

  it('displays invalid button for invalid values', async function () {
    render(
      <CodecovQueryParamsProvider>
        <DatePicker />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/codecov/tests',
            query: {codecovPeriod: '123Dd12'},
          },
        },
      }
    );

    const button = await screen.findByRole('button', {
      name: 'Invalid Period',
      expanded: false,
    });
    expect(button).toBeInTheDocument();
  });
});
