import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {EditOwnershipRules} from './editRulesModal';

describe('Project Ownership Input', () => {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const user = TestStubs.User();

  beforeEach(() => {
    ConfigStore.set('user', user);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: TestStubs.Members(),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', () => {
    render(
      <EditOwnershipRules
        organization={org}
        ownership={TestStubs.CodeOwner({raw: 'url:src'})}
        project={project}
        onCancel={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByText('Globbing Syntax')).toBeInTheDocument();
  });

  it('renders with streamline-targeting-context', () => {
    render(
      <EditOwnershipRules
        organization={{...org, features: ['streamline-targeting-context']}}
        ownership={{
          fallthrough: false,
          autoAssignment: 'Auto Assign to Suspect Commits',
          codeownersAutoSync: false,
          raw: 'url:src',
        }}
        project={project}
        onCancel={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByText(/Assign issues based on custom rules/)).toBeInTheDocument();
  });
});
