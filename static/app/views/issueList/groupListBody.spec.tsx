import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupStore} from 'sentry/stores/groupStore';
import {GroupListBody} from 'sentry/views/issueList/groupListBody';

describe('GroupListBody', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.reset();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
  });

  afterEach(() => {
    GroupStore.reset();
  });

  function renderBody(group: ReturnType<typeof GroupFixture>) {
    GroupStore.add([group]);
    return render(
      <GroupListBody
        groupIds={[group.id]}
        memberList={{}}
        query=""
        displayReprocessingLayout={false}
        groupStatsPeriod="24h"
        loading={false}
        error={null}
        pageSize={25}
        refetchGroups={jest.fn()}
        onActionTaken={jest.fn()}
        selectedProjectIds={[]}
      />,
      {organization}
    );
  }

  it('renders a group whose project slug collides with Object.prototype.constructor', async () => {
    // Regression guard for JAVASCRIPT-39FS: `memberList['constructor']` used to
    // resolve to Object.prototype.constructor via the prototype chain and crash
    // AssigneeSelectorDropdown at `.find()`.
    const group = GroupFixture({
      id: '1',
      project: ProjectFixture({id: '13', slug: 'constructor'}),
    });

    renderBody(group);

    expect(await screen.findByTestId('group')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();
  });

  it('renders a group with a normal project slug not in the indexed memberList', async () => {
    const group = GroupFixture({
      id: '2',
      project: ProjectFixture({id: '14', slug: 'foo-project'}),
    });

    renderBody(group);

    expect(await screen.findByTestId('group')).toBeInTheDocument();
  });
});
