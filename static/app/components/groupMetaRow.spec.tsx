import {ActorFixture} from 'sentry-fixture/actor';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupMetaRow} from 'sentry/components/groupMetaRow';
import {GroupStatus} from 'sentry/types/group';

describe('GroupMetaRow', () => {
  it('renders last and first seen', () => {
    render(
      <GroupMetaRow
        data={GroupFixture({
          project: ProjectFixture({id: 'projectId'}),
          id: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
          firstSeen: '2017-07-01T02:06:02Z',
        })}
      />
    );

    expect(screen.getByText(/ago$/)).toBeInTheDocument();
    expect(screen.getByText(/old$/)).toBeInTheDocument();
  });

  it('renders only first seen', () => {
    render(
      <GroupMetaRow
        data={GroupFixture({
          project: ProjectFixture({id: 'projectId'}),
          id: 'groupId',
          firstSeen: '2017-07-01T02:06:02Z',
          lastSeen: '',
        })}
      />
    );

    expect(screen.getByText(/old$/)).toBeInTheDocument();
    expect(screen.queryByText(/ago$/)).not.toBeInTheDocument();
  });

  it('renders only last seen', () => {
    render(
      <GroupMetaRow
        data={GroupFixture({
          project: ProjectFixture({id: 'projectId'}),
          id: 'groupId',
          firstSeen: '',
          lastSeen: '2017-07-25T22:56:12Z',
        })}
      />
    );

    expect(screen.getByText(/ago$/)).toBeInTheDocument();
    expect(screen.queryByText(/old$/)).not.toBeInTheDocument();
  });

  it('renders all details', () => {
    render(
      <GroupMetaRow
        data={GroupFixture({
          project: ProjectFixture({id: 'projectId'}),
          id: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
          firstSeen: '2017-07-01T02:06:02Z',
          numComments: 14,
          shortId: 'shortId',
          logger: 'javascript logger',
          annotations: [
            {url: 'http://example.com', displayName: 'annotation1'},
            {url: 'http://example.com', displayName: 'annotation2'},
          ],
          assignedTo: ActorFixture({name: 'Assignee Name'}),
          status: GroupStatus.RESOLVED,
        })}
      />
    );

    expect(screen.getByRole('link', {name: 'javascript logger'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'annotation1'})).toBeInTheDocument();
  });

  it('renders assignee when enabled', () => {
    render(
      <GroupMetaRow
        data={GroupFixture({
          project: ProjectFixture({id: 'projectId'}),
          id: 'groupId',
          lastSeen: '2017-07-25T22:56:12Z',
          firstSeen: '2017-07-01T02:06:02Z',
          numComments: 14,
          shortId: 'shortId',
          logger: 'javascript logger',
          annotations: [
            {url: 'http://example.com', displayName: 'annotation1'},
            {url: 'http://example.com', displayName: 'annotation2'},
          ],
          assignedTo: ActorFixture({name: 'Assignee Name'}),
          status: GroupStatus.RESOLVED,
        })}
        showAssignee
      />
    );

    expect(screen.getByText('Assigned to Assignee Name')).toBeInTheDocument();
  });

  it('details subscription reason when mentioned', () => {
    render(
      <GroupMetaRow
        data={GroupFixture({
          project: ProjectFixture({id: 'projectId'}),
          id: 'groupId',
          firstSeen: '2017-07-01T02:06:02Z',
          lastSeen: '2017-07-25T22:56:12Z',
          numComments: 14,
          subscriptionDetails: {reason: 'mentioned'},
        })}
      />
    );

    expect(screen.getByRole('link', {name: '14'})).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/groupId/activity/?filter=comments`
    );
  });
});
// trivial change for CI testing
