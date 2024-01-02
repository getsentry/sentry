import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {BreadcrumbContextProvider} from 'sentry-test/providers/breadcrumbContextProvider';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

describe('SettingsLayout', function () {
  const {routerProps} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [Organization()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 401,
      body: {
        sudoRequired: true,
      },
    });
    MockApiClient.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
  });

  function getTestnav() {
    return screen.queryByRole('navigation', {name: 'Test Nav'});
  }

  it('renders', function () {
    render(
      <BreadcrumbContextProvider>
        <SettingsLayout {...routerProps}>content</SettingsLayout>
      </BreadcrumbContextProvider>
    );
  });

  it('can render navigation', function () {
    render(
      <BreadcrumbContextProvider>
        <SettingsLayout
          {...routerProps}
          renderNavigation={() => <nav aria-label="Test Nav" />}
        >
          content
        </SettingsLayout>
      </BreadcrumbContextProvider>
    );

    expect(getTestnav()).toBeInTheDocument();
  });

  it('can toggle mobile navigation', async function () {
    render(
      <BreadcrumbContextProvider>
        <SettingsLayout
          {...routerProps}
          renderNavigation={opts =>
            opts.isMobileNavVisible ? <nav aria-label="Test Nav" /> : null
          }
        >
          content
        </SettingsLayout>
      </BreadcrumbContextProvider>
    );

    expect(getTestnav()).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Open the menu'}));
    expect(getTestnav()).toBeInTheDocument();
  });
});
