import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {IntegratedOrgPicker} from 'sentry/components/codecov/integratedOrgPicker/integratedOrgPicker';

describe('IntegratedOrgPicker', function () {
  it('can change org', async function () {
    const {router} = render(
      <CodecovQueryParamsProvider>
        <IntegratedOrgPicker />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/codecov/tests',
            query: {integratedOrg: 'codecov'},
          },
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'codecov', expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'sentry'}));

    expect(router.location.search).toBe('?integratedOrg=sentry');

    expect(
      screen.getByRole('button', {name: 'sentry', expanded: false})
    ).toBeInTheDocument();
  });
});
