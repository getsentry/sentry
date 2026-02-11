import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
      expect(screen.getByRole('heading', {name: 'DevKit Crashes'})).toBeInTheDocument();
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
      expect(screen.getByRole('heading', {name: 'DevKit Crashes'})).toBeInTheDocument();
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
});
