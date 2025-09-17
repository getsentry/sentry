import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import TempestSettings from 'sentry/views/settings/project/tempest';

describe('TempestSettings', () => {
  const {organization, project} = initializeOrg();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/tempest-credentials/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });
  });

  describe('Access Control', () => {
    it('renders warning alert when user does not have tempest access', () => {
      const organizationWithoutAccess = OrganizationFixture({
        features: [],
        enabledConsolePlatforms: [],
      });

      render(
        <TempestSettings organization={organizationWithoutAccess} project={project} />
      );

      expect(
        screen.getByText("You don't have access to this feature")
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'PlayStation'})
      ).not.toBeInTheDocument();
    });

    it('renders settings when user has tempest-access feature', () => {
      const organizationWithFeature = OrganizationFixture({
        features: ['tempest-access'],
        enabledConsolePlatforms: [],
      });

      render(
        <TempestSettings organization={organizationWithFeature} project={project} />
      );

      expect(
        screen.queryByText("You don't have access to this feature")
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'DevKit Crashes'})).toBeInTheDocument();
    });

    it('renders settings when user has playstation console platform enabled', () => {
      const organizationWithPlatform = OrganizationFixture({
        features: [],
        enabledConsolePlatforms: ['playstation'],
      });

      render(
        <TempestSettings organization={organizationWithPlatform} project={project} />
      );

      expect(
        screen.queryByText("You don't have access to this feature")
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'DevKit Crashes'})).toBeInTheDocument();
    });

    it('renders settings when user has both tempest-access feature and playstation platform', () => {
      const organizationWithBoth = OrganizationFixture({
        features: ['tempest-access'],
        enabledConsolePlatforms: ['playstation'],
      });

      render(<TempestSettings organization={organizationWithBoth} project={project} />);

      expect(
        screen.queryByText("You don't have access to this feature")
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'DevKit Crashes'})).toBeInTheDocument();
    });

    it('does not grant access with other console platforms', () => {
      const organizationWithOtherPlatform = OrganizationFixture({
        features: [],
        enabledConsolePlatforms: ['xbox', 'nintendo'],
      });

      render(
        <TempestSettings organization={organizationWithOtherPlatform} project={project} />
      );

      expect(
        screen.getByText("You don't have access to this feature")
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'DevKit Crashes'})
      ).not.toBeInTheDocument();
    });
  });
});
