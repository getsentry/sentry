import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import TempestSettings from 'sentry/views/settings/project/tempest';

describe('TempestSettings', () => {
  const project = ProjectFixture();

  const setupMocks = (organization: Organization) => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/tempest-credentials/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });
  };

  describe('Access Control', () => {
    it('renders warning alert when user does not have tempest access', () => {
      const organizationWithoutAccess = OrganizationFixture({
        enabledConsolePlatforms: [],
      });
      setupMocks(organizationWithoutAccess);

      render(<TempestSettings />, {
        organization: organizationWithoutAccess,
        outletContext: {project},
      });

      expect(
        screen.getByText("You don't have access to this feature")
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'PlayStation'})
      ).not.toBeInTheDocument();
    });

    it('renders settings when user has playstation console platform enabled', () => {
      const organizationWithPlatform = OrganizationFixture({
        enabledConsolePlatforms: ['playstation'],
      });
      setupMocks(organizationWithPlatform);

      render(<TempestSettings />, {
        organization: organizationWithPlatform,
        outletContext: {project},
      });

      expect(
        screen.queryByText("You don't have access to this feature")
      ).not.toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'DevKit'})).toBeInTheDocument();
    });

    it('renders settings when user has playstation platform', () => {
      const organizationWithBoth = OrganizationFixture({
        enabledConsolePlatforms: ['playstation'],
      });
      setupMocks(organizationWithBoth);

      render(<TempestSettings />, {
        organization: organizationWithBoth,
        outletContext: {project},
      });

      expect(
        screen.queryByText("You don't have access to this feature")
      ).not.toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'DevKit'})).toBeInTheDocument();
    });

    it('does not grant access with other console platforms', () => {
      const organizationWithOtherPlatform = OrganizationFixture({
        enabledConsolePlatforms: ['xbox', 'nintendo'],
      });
      setupMocks(organizationWithOtherPlatform);

      render(<TempestSettings />, {
        organization: organizationWithOtherPlatform,
        outletContext: {project},
      });

      expect(
        screen.getByText("You don't have access to this feature")
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'DevKit Crashes'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('clears the guided step and setup instructions when switching tabs', async () => {
      const organization = OrganizationFixture({
        enabledConsolePlatforms: ['playstation'],
      });
      setupMocks(organization);
      const onNuqsUrlUpdate = jest.fn();

      const {router} = render(<TempestSettings />, {
        organization,
        outletContext: {project},
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/settings/org-slug/projects/project-slug/playstation/',
            query: {
              tab: 'retail',
              guidedStep: '2',
              setupInstructions: 'true',
              other: 'kept',
            },
          },
        },
      });

      await userEvent.click(screen.getByRole('tab', {name: 'DevKit'}));

      expect(
        await screen.findByText('Get Started with DevKit Crash Monitoring')
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(router.location.query).toEqual({
          tab: 'devkit-crashes',
          other: 'kept',
          guidedStep: '1',
        })
      );
      expect(onNuqsUrlUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          queryString: '?other=kept&tab=devkit-crashes',
          options: expect.objectContaining({history: 'push'}),
        })
      );
    });

    it('writes setupInstructions=false when closing the setup instructions', async () => {
      const organization = OrganizationFixture({
        enabledConsolePlatforms: ['playstation'],
      });
      setupMocks(organization);
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/tempest-credentials/`,
        body: [
          {
            id: 1,
            clientId: 'client-id',
            clientSecret: 'secret',
            createdByEmail: 'user@example.com',
            createdById: 1,
            dateAdded: '2024-01-01T00:00:00Z',
            dateUpdated: '2024-01-01T00:00:00Z',
            latestFetchedItemId: '',
            message: '',
            messageType: null,
          },
        ],
      });
      MockApiClient.addMockResponse({url: '/tempest-ips/', body: []});

      const onNuqsUrlUpdate = jest.fn();

      const {router} = render(<TempestSettings />, {
        organization,
        outletContext: {project},
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/settings/org-slug/projects/project-slug/playstation/',
            query: {tab: 'retail', setupInstructions: 'true'},
          },
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Close Setup Instructions'})
      );

      await waitFor(() => expect(router.location.query.setupInstructions).toBe('false'));
      expect(onNuqsUrlUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({history: 'push'}),
        })
      );
    });
  });
});
