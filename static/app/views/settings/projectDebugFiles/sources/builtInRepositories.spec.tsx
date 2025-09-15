import {BuiltInSymbolSourcesFixture} from 'sentry-fixture/builtInSymbolSources';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import BuiltInRepositories from 'sentry/views/settings/projectDebugFiles/sources/builtInRepositories';

describe('Built-in Repositories', () => {
  const api = new MockApiClient();
  const {project, organization} = initializeOrg();

  const builtinSymbolSourceOptions = BuiltInSymbolSourcesFixture();
  const builtinSymbolSources = ['ios', 'microsoft', 'android'];

  it('renders', () => {
    render(
      <BuiltInRepositories
        api={api}
        organization={organization}
        project={project}
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
