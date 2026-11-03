import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {ConfigStore} from 'sentry/stores/configStore';
import {ModalStore} from 'sentry/stores/modalStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {OrganizationContextProvider} from 'sentry/views/organizationContext';

// Uses the real sudo modal, unlike organizationContext.spec.tsx which mocks it.
describe('OrganizationContext sudo modal', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.init();
    OrganizationStore.reset();
    ModalStore.reset();
  });

  it('renders the superuser form for a 403 org without refetching in a loop', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    ConfigStore.set('user', UserFixture({isSuperuser: true, hasPasswordAuth: true}));

    const permissionDenied = {
      statusCode: 403,
      body: {detail: 'You do not have permission to perform this action.'},
    };
    const orgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      ...permissionDenied,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      ...permissionDenied,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      ...permissionDenied,
    });
    MockApiClient.addMockResponse({url: '/authenticators/', body: []});

    render(
      <OrganizationContextProvider>
        <GlobalModal />
      </OrganizationContextProvider>,
      {
        initialRouterConfig: {
          route: '/organizations/:orgId/',
          location: {pathname: '/organizations/org-slug/'},
        },
      }
    );

    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
    expect(orgMock.mock.calls.length).toBeLessThanOrEqual(3);
    errorSpy.mockRestore();
  });
});
