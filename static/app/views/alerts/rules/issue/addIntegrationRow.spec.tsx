import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AddIntegrationRow from 'sentry/views/alerts/rules/issue/addIntegrationRow';

jest.mock('sentry/actionCreators/modal');

describe('AddIntegrationRow', function () {
  let project, org;
  const integrationSlug = 'github';
  const providers = [GitHubIntegrationProviderFixture()];

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    project = ProjectFixture();
    org = OrganizationFixture();

    jest.clearAllMocks();
  });

  const getComponent = () => (
    <AddIntegrationRow
      integrationSlug={integrationSlug}
      organization={org}
      project={project}
      closeModal={jest.fn()}
      setHasError={jest.fn()}
    />
  );

  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=${integrationSlug}`,
      body: {
        providers: providers,
      },
    });

    render(getComponent());

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /add integration/i})).toBeInTheDocument();
    });
  });

  it('opens the setup dialog on click', async function () {
    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus, close: jest.fn()});
    // any is needed here because getSentry has different types for global
    (global as any).open = open;

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=${integrationSlug}`,
      body: {
        providers: providers,
      },
    });

    render(getComponent());

    await waitFor(() => {
      userEvent.click(screen.getByRole('button', {name: /add integration/i}));
      expect(open.mock.calls).toHaveLength(1);
      expect(focus.mock.calls).toHaveLength(1);
      expect(open.mock.calls[0][2]).toBe(
        'scrollbars=yes,width=100,height=100,top=334,left=462'
      );
    });
  });

  it('handles API error', async function () {
    const setHasError = jest.fn();

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=${integrationSlug}`,
      statusCode: 400,
      body: {error: 'internal error'},
    });

    render(
      <AddIntegrationRow
        integrationSlug={integrationSlug}
        organization={org}
        project={project}
        closeModal={jest.fn()}
        setHasError={setHasError}
      />
    );

    await waitFor(() => {
      expect(setHasError).toHaveBeenCalled();
    });
  });
});
