import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';

const organization = OrganizationFixture({
  features: ['preprod-build-distribution'],
});

const baseBuild = {
  id: 'build-1',
  project_id: 1,
  project_slug: 'project-1',
  state: BuildDetailsState.UPLOADED,
  app_info: {
    app_id: 'com.example.app',
    name: 'Example App',
    platform: 'ios',
    build_number: '1',
    version: '1.0.0',
    date_added: '2024-01-01T00:00:00Z',
  },
  distribution_info: {
    is_installable: true,
    download_count: 1234,
    release_notes: null,
  },
  vcs_info: {
    head_sha: 'abcdef1',
  },
};

describe('PreprodBuildsTable', () => {
  it('renders size columns by default', () => {
    render(
      <PreprodBuildsTable
        builds={[baseBuild]}
        isLoading={false}
        organizationSlug={organization.slug}
      />,
      {organization}
    );

    expect(screen.getByText('Install Size')).toBeInTheDocument();
    expect(screen.getByText('Download Size')).toBeInTheDocument();
    expect(screen.queryByText('Download Count')).not.toBeInTheDocument();
  });

  it('renders distribution columns and filters non-installable builds', () => {
    const nonInstallableBuild = {
      ...baseBuild,
      id: 'build-2',
      app_info: {
        ...baseBuild.app_info,
        name: 'Non Installable App',
      },
      distribution_info: {
        ...baseBuild.distribution_info,
        is_installable: false,
        download_count: 99,
      },
    };

    render(
      <PreprodBuildsTable
        builds={[baseBuild, nonInstallableBuild]}
        display={PreprodBuildsDisplay.DISTRIBUTION}
        isLoading={false}
        organizationSlug={organization.slug}
      />,
      {organization}
    );

    expect(screen.getByText('Download Count')).toBeInTheDocument();
    expect(screen.queryByText('Download Size')).not.toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.queryByText('Non Installable App')).not.toBeInTheDocument();

    const rowLink = screen.getByRole('link', {name: /Example App/});
    expect(rowLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/preprod/1/build-1/install/`
    );
  });
});
