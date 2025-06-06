import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';

describe('IntegratedOrgSelector', function () {
  it('renders when given integrated org', async function () {
    render(
      <CodecovQueryParamsProvider>
        <IntegratedOrgSelector />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {integratedOrg: 'my-other-org-with-a-super-long-name'},
          },
        },
      }
    );
    expect(
      await screen.findByRole('button', {name: 'my-other-org-with-a-super-long-name'})
    ).toBeInTheDocument();
  });

  it('renders the chosen org as the first option', async function () {
    render(
      <CodecovQueryParamsProvider>
        <IntegratedOrgSelector />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {integratedOrg: 'my-other-org-with-a-super-long-name'},
          },
        },
      }
    );

    const button = await screen.findByRole('button', {
      name: 'my-other-org-with-a-super-long-name',
    });
    await userEvent.click(button);
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('my-other-org-with-a-super-long-name');
  });
});
