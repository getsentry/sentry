import {BuiltInSymbolSources} from 'sentry-fixture/builtInSymbolSources';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import BuiltInRepositories from 'sentry/views/settings/projectDebugFiles/sources/builtInRepositories';

describe('Built-in Repositories', function () {
  const api = new MockApiClient();
  const {project, organization} = initializeOrg();

  const builtinSymbolSourceOptions = BuiltInSymbolSources();
  const builtinSymbolSources = ['ios', 'microsoft', 'android'];

  it('renders', function () {
    render(
      <BuiltInRepositories
        api={api}
        organization={organization}
        project={project}
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
