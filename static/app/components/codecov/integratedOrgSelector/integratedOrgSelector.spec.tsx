import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';

const mockIntegrations = [
  {name: 'my-other-org-with-a-super-long-name', id: '1'},
  {name: 'my-other-org-with-a-super-long-name', id: '2'},
];

const mockApiCall = () => {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/integrations/`,
    method: 'GET',
    body: mockIntegrations,
  });
};

describe('IntegratedOrgSelector', function () {
  it('renders when given integrated org', async function () {
    mockApiCall();
    render(
      <CodecovQueryParamsProvider>
        <IntegratedOrgSelector />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {integratedOrgId: '1'},
          },
        },
      }
    );
    expect(
      await screen.findByRole('button', {name: 'my-other-org-with-a-super-long-name'})
    ).toBeInTheDocument();
  });

  it('renders the chosen org as the first option', async function () {
    mockApiCall();
    render(
      <CodecovQueryParamsProvider>
        <IntegratedOrgSelector />
      </CodecovQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {integratedOrgId: '2'},
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
