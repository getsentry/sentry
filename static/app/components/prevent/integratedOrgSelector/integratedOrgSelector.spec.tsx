import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import {IntegratedOrgSelector} from 'sentry/components/prevent/integratedOrgSelector/integratedOrgSelector';
import localStorageWrapper from 'sentry/utils/localStorage';

const MOCK_INTEGRATED_ORG_NAME = 'my-other-org-with-a-super-long-name';
const MOCK_INTEGRATED_ORG_NAME_2 = 'other-org';

const mockIntegrations = [
  {name: MOCK_INTEGRATED_ORG_NAME, id: '1', status: 'active'},
  {name: MOCK_INTEGRATED_ORG_NAME_2, id: '2', status: 'active'},
];

const mockApiCall = () => {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/integrations/`,
    method: 'GET',
    body: mockIntegrations,
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/config/integrations/`,
    method: 'GET',
    body: {
      providers: [GitHubIntegrationProviderFixture()],
    },
  });
};

describe('IntegratedOrgSelector', () => {
  beforeEach(() => {
    localStorageWrapper.clear();

    localStorageWrapper.setItem(
      'prevent-selection:org-slug',
      JSON.stringify({
        [MOCK_INTEGRATED_ORG_NAME]: {
          integratedOrgId: '1',
        },
        [MOCK_INTEGRATED_ORG_NAME_2]: {
          integratedOrgId: '2',
        },
      })
    );
  });

  it('renders when given integrated org', async () => {
    mockApiCall();
    render(
      <PreventQueryParamsProvider>
        <IntegratedOrgSelector />
      </PreventQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {
              integratedOrgName: MOCK_INTEGRATED_ORG_NAME,
            },
          },
        },
      }
    );
    expect(
      await screen.findByRole('button', {name: MOCK_INTEGRATED_ORG_NAME})
    ).toBeInTheDocument();
  });

  it('renders the chosen org as the first option', async () => {
    mockApiCall();
    render(
      <PreventQueryParamsProvider>
        <IntegratedOrgSelector />
      </PreventQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {
              integratedOrgName: MOCK_INTEGRATED_ORG_NAME_2,
            },
          },
        },
      }
    );

    const button = await screen.findByRole('button', {
      name: MOCK_INTEGRATED_ORG_NAME_2,
    });
    await userEvent.click(button);
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent(MOCK_INTEGRATED_ORG_NAME_2);
  });
});
