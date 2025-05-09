import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import SettingsIndex from 'sentry/views/settings/settingsIndex';

import {BreadcrumbProvider} from './components/settingsBreadcrumb/context';

describe('SettingsIndex', function () {
  const props = {
    router: RouterFixture(),
    location: {} as any,
    routes: [],
    route: {},
    params: {},
    routeParams: {},
  };

  it('renders', function () {
    render(
      <BreadcrumbProvider>
        <SettingsIndex {...props} />
      </BreadcrumbProvider>
    );
  });

  it('has different links for self-hosted users', function () {
    ConfigStore.set('isSelfHosted', true);

    render(
      <BreadcrumbProvider>
        <SettingsIndex {...props} />
      </BreadcrumbProvider>
    );

    const formLink = screen.getByText('Community Forums');

    expect(formLink).toBeInTheDocument();
    expect(formLink).toHaveAttribute('href', 'https://forum.sentry.io/');
  });
});
