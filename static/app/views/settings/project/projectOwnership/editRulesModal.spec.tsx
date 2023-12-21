import {Members} from 'sentry-fixture/members';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {User} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {IssueOwnership} from 'sentry/types';

import {EditOwnershipRules} from './editRulesModal';

describe('Project Ownership Input', () => {
  const org = Organization();
  const project = ProjectFixture();
  const user = User();

  beforeEach(() => {
    ConfigStore.set('user', user);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: Members(),
    });
  });
  const ownership: IssueOwnership = {
    fallthrough: false,
    autoAssignment: 'Auto Assign to Suspect Commits',
    codeownersAutoSync: false,
    raw: 'url:src',
    isActive: true,
    dateCreated: '',
    lastUpdated: '',
  };

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', () => {
    render(
      <EditOwnershipRules
        organization={org}
        ownership={ownership}
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
        ownership={ownership}
        project={project}
        onCancel={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByText(/Assign issues based on custom rules/)).toBeInTheDocument();
  });
});
