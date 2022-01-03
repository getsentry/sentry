import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DEBUG_SOURCE_TYPES} from 'sentry/data/debugFileSources';
import {CustomRepo, CustomRepoType} from 'sentry/types/debugFiles';
import CustomRepositories from 'sentry/views/settings/projectDebugFiles/sources/customRepositories';

describe('Custom Repositories', function () {
  const api = new MockApiClient();
  const {project, organization, router} = initializeOrg();

  const props = {
    api,
    organization,
    router,
    projSlug: project.slug,
    isLoading: false,
    location: router.location,
    customRepositories: [],
  };

  const repository: CustomRepo = {
    id: '7ebdb871-eb65-0183-8001-ea7df90613a7',
    layout: {type: 'native', casing: 'default'},
    name: 'New Repo',
    password: {'hidden-secret': true},
    type: CustomRepoType.HTTP,
    url: 'https://msdl.microsoft.com/download/symbols/',
    username: 'admin',
  };

  it('renders', function () {
    const {rerender} = mountWithTheme(<CustomRepositories {...props} />);

    // Section title
    expect(screen.getByText('Custom Repositories')).toBeInTheDocument();

    // Feature disabled warning
    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();

    // Expand help component
    userEvent.click(screen.getByRole('button', {name: 'Help'}));

    // Help content
    expect(
      screen.getByText(
        "# Enables the Custom Repositories feature SENTRY_FEATURES['custom-symbol-sources'] = True"
      )
    ).toBeInTheDocument();

    // Disabled button
    expect(screen.getByText('Add Repository').closest('button')).toBeDisabled();

    // Content
    expect(screen.getByText('No custom repositories configured')).toBeInTheDocument();

    // Renders disabled repository list
    rerender(<CustomRepositories {...props} customRepositories={[repository]} />);

    // Content
    expect(screen.getByText(repository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.http)).toBeInTheDocument();
    expect(screen.getByLabelText('Actions')).toBeInTheDocument();
    expect(screen.getByLabelText('Actions')).toBeDisabled();
  });

  it('renders with custom-symbol-sources feature enabled', function () {
    const newOrganization = {
      ...organization,
      features: [...organization.features, 'custom-symbol-sources'],
    };

    const {rerender} = mountWithTheme(
      <CustomRepositories {...props} organization={newOrganization} />
    );

    // Section title
    expect(screen.getByText('Custom Repositories')).toBeInTheDocument();

    // Enabled button
    expect(screen.getByText('Add Repository').closest('button')).toBeEnabled();

    // Content
    expect(screen.getByText('No custom repositories configured')).toBeInTheDocument();

    // Renders enabled repository list
    rerender(
      <CustomRepositories
        {...props}
        organization={newOrganization}
        customRepositories={[repository]}
      />
    );

    // Content
    expect(screen.getByText(repository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.http)).toBeInTheDocument();
    expect(screen.getByLabelText('Actions')).toBeInTheDocument();
    expect(screen.getByLabelText('Actions')).toBeEnabled();
  });
});
