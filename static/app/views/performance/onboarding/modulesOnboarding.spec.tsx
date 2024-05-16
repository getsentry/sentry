import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {ModulesOnboarding} from './modulesOnboarding';

describe('ModulesOnboarding', () => {
  const organization = OrganizationFixture();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders children correctly', async () => {
    const eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [{'count()': 1}]},
    });

    render(
      <ModulesOnboarding
        moduleQueryFilter=""
        onboardingContent={<div>Start collecting Insights!</div>}
        referrer=""
      >
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    expect(eventsMock).toHaveBeenCalled();
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    await screen.getByText('Module Content');
  });

  it('renders onboarding content correctly', async () => {
    const eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    render(
      <ModulesOnboarding
        moduleQueryFilter=""
        onboardingContent={<div>Start collecting Insights!</div>}
        referrer=""
      >
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    expect(eventsMock).toHaveBeenCalled();
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    await screen.findByText('Start collecting Insights!');
  });
});
