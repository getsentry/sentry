import {BreadcrumbContextProvider} from 'sentry-test/providers/breadcrumbContextProvider';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

describe('SettingsLayout', function () {
  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    Client.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization()],
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 401,
      body: {
        sudoRequired: true,
      },
    });
    Client.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
  });

  function getTestnav() {
    return screen.queryByRole('navigation', {name: 'Test Nav'});
  }

  it('renders', function () {
    const {container} = render(
      <BreadcrumbContextProvider>
        <SettingsLayout router={TestStubs.router()} route={{}} routes={[]} />
      </BreadcrumbContextProvider>
    );

    expect(container).toSnapshot();
  });

  it('can render navigation', function () {
    render(
      <BreadcrumbContextProvider>
        <SettingsLayout
          router={TestStubs.router()}
          route={{}}
          routes={[]}
          renderNavigation={() => <nav aria-label="Test Nav" />}
        />
      </BreadcrumbContextProvider>
    );

    expect(getTestnav()).toBeInTheDocument();
  });

  it('can toggle mobile navigation', function () {
    render(
      <BreadcrumbContextProvider>
        <SettingsLayout
          router={TestStubs.router()}
          route={{}}
          routes={[]}
          renderNavigation={opts =>
            opts.isMobileNavVisible ? <nav aria-label="Test Nav" /> : null
          }
        />
      </BreadcrumbContextProvider>
    );

    expect(getTestnav()).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Open the menu'}));
    expect(getTestnav()).toBeInTheDocument();
  });
});
