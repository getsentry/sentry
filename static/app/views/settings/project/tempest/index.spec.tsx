import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import TempestSettings from 'sentry/views/settings/project/tempest';

describe('TempestSettings', function () {
  const {organization, project} = initializeOrg();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/tempest-credentials/`,
      body: [],
    });
  });

  describe('Access Control', () => {
    it('renders warning alert when user does not have tempest access', function () {
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

    it('renders settings when user has tempest-access feature', function () {
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
      expect(screen.getByRole('heading', {name: 'PlayStation'})).toBeInTheDocument();
    });

    it('renders settings when user has playstation console platform enabled', function () {
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
      expect(screen.getByRole('heading', {name: 'PlayStation'})).toBeInTheDocument();
    });

    it('renders settings when user has both tempest-access feature and playstation platform', function () {
      const organizationWithBoth = OrganizationFixture({
        features: ['tempest-access'],
        enabledConsolePlatforms: ['playstation'],
      });

      render(<TempestSettings organization={organizationWithBoth} project={project} />);

      expect(
        screen.queryByText("You don't have access to this feature")
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'PlayStation'})).toBeInTheDocument();
    });

    it('does not grant access with other console platforms', function () {
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
        screen.queryByRole('heading', {name: 'PlayStation'})
      ).not.toBeInTheDocument();
    });
  });
});
