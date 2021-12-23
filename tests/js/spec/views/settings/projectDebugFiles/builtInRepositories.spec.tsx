import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import BuiltInRepositories from 'sentry/views/settings/projectDebugFiles/externalSources/builtInRepositories';

describe('Built-in Repositories', function () {
  const api = new MockApiClient();
  const {project, organization} = initializeOrg();

  const builtinSymbolSourceOptions = TestStubs.BuiltInSymbolSources();
  const builtinSymbolSources = ['ios', 'microsoft', 'android'];

  it('renders', function () {
    mountWithTheme(
      <BuiltInRepositories
        api={api}
        organization={organization}
        projSlug={project.slug}
        isLoading={false}
        builtinSymbolSourceOptions={builtinSymbolSourceOptions}
        builtinSymbolSources={builtinSymbolSources}
      />
    );

    // Section Title
    expect(screen.queryAllByText('Built-in Repositories')).toHaveLength(2);

    // Feature Disabled warning
    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();

    // Disabled Field
    expect(screen.getByText('Microsoft')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders with required feature flag enabled', function () {
    mountWithTheme(
      <BuiltInRepositories
        api={api}
        organization={{
          ...organization,
          features: [...organization.features, 'symbol-sources'],
        }}
        projSlug={project.slug}
        isLoading={false}
        builtinSymbolSourceOptions={builtinSymbolSourceOptions}
        builtinSymbolSources={builtinSymbolSources}
      />
    );

    // Section Title
    expect(screen.queryAllByText('Built-in Repositories')).toHaveLength(2);

    // Enabled Field
    expect(screen.getByText('Microsoft')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeEnabled();
  });
});
