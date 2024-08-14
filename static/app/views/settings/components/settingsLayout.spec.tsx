import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

import {BreadcrumbProvider} from './settingsBreadcrumb/context';

describe('SettingsLayout', function () {
  const {routerProps} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [OrganizationFixture()],
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
      <BreadcrumbProvider>
        <SettingsLayout {...routerProps}>content</SettingsLayout>
      </BreadcrumbProvider>
    );
  });

  it('can render navigation', function () {
    render(
      <BreadcrumbProvider>
        <SettingsLayout
          {...routerProps}
          renderNavigation={() => <nav aria-label="Test Nav" />}
        >
          content
        </SettingsLayout>
      </BreadcrumbProvider>
    );

    expect(getTestnav()).toBeInTheDocument();
  });

  it('can toggle mobile navigation', async function () {
    render(
      <BreadcrumbProvider>
        <SettingsLayout
          {...routerProps}
          renderNavigation={opts =>
            opts.isMobileNavVisible ? <nav aria-label="Test Nav" /> : null
          }
        >
          content
        </SettingsLayout>
      </BreadcrumbProvider>
    );

    expect(getTestnav()).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Open the menu'}));
    expect(getTestnav()).toBeInTheDocument();
  });
});
