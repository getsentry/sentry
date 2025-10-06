import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

import {BreadcrumbProvider} from './settingsBreadcrumb/context';

describe('SettingsLayout', () => {
  const {routerProps} = initializeOrg();

  beforeEach(() => {
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

  it('renders', () => {
    render(
      <BreadcrumbProvider>
        <SettingsLayout {...routerProps}>content</SettingsLayout>
      </BreadcrumbProvider>
    );
  });
});
