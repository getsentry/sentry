import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SentryAppDetailsModal from 'sentry/components/modals/sentryAppDetailsModal';

function renderMockRequests({sentryAppSlug}: {sentryAppSlug: string}) {
  const features = MockApiClient.addMockResponse({
    url: `/sentry-apps/${sentryAppSlug}/features/`,
    method: 'GET',
    body: [],
  });

  const interaction = MockApiClient.addMockResponse({
    url: `/sentry-apps/${sentryAppSlug}/interaction/`,
    method: 'POST',
    statusCode: 200,
    body: {},
  });

  return {features, interaction};
}

describe('SentryAppDetailsModal', function () {
  const sentryApp = SentryAppFixture();

  it('renders', function () {
    renderMockRequests({sentryAppSlug: sentryApp.slug});

    render(
      <SentryAppDetailsModal
        closeModal={jest.fn()}
        isInstalled={false}
        onInstall={jest.fn()}
        organization={OrganizationFixture()}
        sentryApp={sentryApp}
      />
    );

    expect(screen.getByText(sentryApp.name)).toBeInTheDocument();
  });

  it('records interaction request', function () {
    const mockRequests = renderMockRequests({sentryAppSlug: sentryApp.slug});

    render(
      <SentryAppDetailsModal
        closeModal={jest.fn()}
        isInstalled={false}
        onInstall={jest.fn()}
        organization={OrganizationFixture()}
        sentryApp={sentryApp}
      />
    );

    expect(mockRequests.interaction).toHaveBeenCalledWith(
      `/sentry-apps/${sentryApp.slug}/interaction/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          tsdbField: 'sentry_app_viewed',
        },
      })
    );
  });

  it('displays the Integrations description', function () {
    renderMockRequests({sentryAppSlug: sentryApp.slug});

    render(
      <SentryAppDetailsModal
        closeModal={jest.fn()}
        isInstalled={false}
        onInstall={jest.fn()}
        organization={OrganizationFixture()}
        sentryApp={sentryApp}
      />
    );

    expect(screen.getByText(String(sentryApp.overview))).toBeInTheDocument();
  });

  it('closes when Cancel is clicked', async function () {
    renderMockRequests({sentryAppSlug: sentryApp.slug});

    const handleCloseModal = jest.fn();

    render(
      <SentryAppDetailsModal
        closeModal={handleCloseModal}
        isInstalled={false}
        onInstall={jest.fn()}
        organization={OrganizationFixture()}
        sentryApp={sentryApp}
      />
    );

    await userEvent.click(screen.getByText('Cancel'));

    expect(handleCloseModal).toHaveBeenCalled();
  });

  it('installs the Integration when Install is clicked', async function () {
    renderMockRequests({sentryAppSlug: sentryApp.slug});

    const handleOnInstall = jest.fn();

    render(
      <SentryAppDetailsModal
        closeModal={jest.fn()}
        isInstalled={false}
        onInstall={handleOnInstall}
        organization={OrganizationFixture()}
        sentryApp={sentryApp}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Accept & Install'}));

    expect(handleOnInstall).toHaveBeenCalled();
  });

  it('does not display the Install button, when the User does not have permission to install Integrations', function () {
    renderMockRequests({sentryAppSlug: sentryApp.slug});

    const noAccessOrg = OrganizationFixture({access: []});

    render(
      <SentryAppDetailsModal
        closeModal={jest.fn()}
        isInstalled={false}
        onInstall={jest.fn()}
        organization={noAccessOrg}
        sentryApp={sentryApp}
      />,
      {organization: noAccessOrg}
    );

    expect(
      screen.queryByRole('button', {name: 'Accept & Install'})
    ).not.toBeInTheDocument();
  });

  it('render the Install button disabled, when the Integration is installed', function () {
    renderMockRequests({sentryAppSlug: sentryApp.slug});

    render(
      <SentryAppDetailsModal
        closeModal={jest.fn()}
        isInstalled
        onInstall={jest.fn()}
        organization={OrganizationFixture()}
        sentryApp={sentryApp}
      />
    );

    expect(screen.getByRole('button', {name: 'Accept & Install'})).toBeDisabled();
  });

  it('does not render permissions, when the Integration requires no permissions', function () {
    renderMockRequests({sentryAppSlug: sentryApp.slug});

    render(
      <SentryAppDetailsModal
        closeModal={jest.fn()}
        isInstalled={false}
        onInstall={jest.fn()}
        organization={OrganizationFixture()}
        sentryApp={{...sentryApp, scopes: []}}
      />
    );

    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
  });
});
