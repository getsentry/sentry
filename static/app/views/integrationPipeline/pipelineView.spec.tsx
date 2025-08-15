// The pipeline view renders a Router inside of it and
// does not need the providers provided by our wrapped render function.
// Use the original to avoid doubling up.
// eslint-disable-next-line no-restricted-imports
import {render, screen, waitFor} from '@testing-library/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import PipelineView from 'sentry/views/integrationPipeline/pipelineView';

function MockAwsLambdaProjectSelect() {
  return <div>mock_AwsLambdaProjectSelect</div>;
}

jest.mock(
  'sentry/views/integrationPipeline/awsLambdaProjectSelect',
  () => MockAwsLambdaProjectSelect
);

describe('PipelineView', () => {
  beforeEach(() => {
    const configState = ConfigStore.getState();
    const organization = OrganizationFixture();

    ConfigStore.init();
    ConfigStore.loadInitialData(configState);

    HookStore.init();

    // Mock the global fetch for bootstrap config endpoint
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            csrfCookieName: 'csrf-token',
            superUserCookieName: 'su-token',
            superUserCookieDomain: 'sentry.io',
          }),
      } as Response)
    );

    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [organization],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: organization,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders awsLambdaProjectSelect', async () => {
    render(<PipelineView pipelineName="awsLambdaProjectSelect" someField="someVal" />);

    await waitFor(() => {
      expect(screen.getByText('mock_AwsLambdaProjectSelect')).toBeInTheDocument();
    });
    expect(document.title).toBe('AWS Lambda Select Project');
  });

  it('errors on invalid pipelineName', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<PipelineView pipelineName="other" />)).toThrow(
      'Invalid pipeline name other'
    );
  });
});
