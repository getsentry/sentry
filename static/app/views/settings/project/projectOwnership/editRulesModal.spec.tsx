import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {IssueOwnership} from 'sentry/types';

import {EditOwnershipRules} from './editRulesModal';

describe('Project Ownership Input', () => {
  const org = OrganizationFixture();
  const project = ProjectFixture();
  const user = UserFixture();

  beforeEach(() => {
    ConfigStore.set('user', user);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: MembersFixture(),
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

    expect(screen.getByText(/Assign issues based on custom rules/)).toBeInTheDocument();
  });
});
