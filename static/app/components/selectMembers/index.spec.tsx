import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import SelectMembers from 'sentry/components/selectMembers';

describe('SelectMembers', () => {
  const organization = OrganizationFixture();
  const projectUser = UserFixture({
    id: '1',
    email: 'project-member@example.com',
    name: 'Project Member',
  });
  const outsideUser = UserFixture({
    id: '2',
    email: 'outside-member@example.com',
    name: 'Outside Member',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('loads project members as default options', async () => {
    const onChange = jest.fn();
    const projectMembersRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({project: ['123']})],
      body: [{user: projectUser, role: 'member', projects: ['project-slug']}],
    });

    render(
      <SelectMembers
        aria-label="Member"
        onChange={onChange}
        organization={organization}
        projectIds={['123']}
        value={null}
      />,
      {organization}
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Member'}),
      'Project Member'
    );

    expect(projectMembersRequest).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          email: projectUser.email,
          id: projectUser.id,
          name: projectUser.name,
          type: 'user',
        },
        value: projectUser.id,
      })
    );
  });

  it('searches organization members and disables users outside the project', async () => {
    const projectMembersRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({project: ['123']})],
      body: [{user: projectUser, role: 'member', projects: ['project-slug']}],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [],
    });
    const memberSearchRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({query: 'outside'})],
      body: [{user: outsideUser, role: 'member', projects: []}],
    });

    render(
      <SelectMembers
        aria-label="Member"
        onChange={jest.fn()}
        organization={organization}
        projectIds={['123']}
        value={null}
      />,
      {organization}
    );

    const input = await screen.findByRole('textbox', {name: 'Member'});
    await waitFor(() => expect(projectMembersRequest).toHaveBeenCalled());

    await selectEvent.openMenu(input);
    await userEvent.type(input, 'outside');

    const outsideMemberOption = (await screen.findByText('Outside Member')).closest(
      '[role="menuitemradio"]'
    );

    expect(memberSearchRequest).toHaveBeenCalled();
    expect(outsideMemberOption).toHaveAttribute('aria-disabled', 'true');
  });
});
