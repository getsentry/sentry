import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TeamParticipant, UserParticipant} from 'sentry/types';
import {IssueCategory} from 'sentry/types';
import UpdatedGroupHeader from 'sentry/views/issueDetails/updatedHeader';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

describe('UpdatedGroupHeader', () => {
  const baseUrl = 'BASE_URL/';
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    platform: 'javascript',
    teams: [TeamFixture()],
  });
  const group = GroupFixture({issueCategory: IssueCategory.ERROR});

  describe('JS Project Error Issue', () => {
    const defaultProps = {
      organization,
      baseUrl,
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
        method: 'GET',
        body: {},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/replay-count/',
        body: {},
      });
    });

    it('shows all elements of header', async () => {
      const teams: TeamParticipant[] = [{...TeamFixture(), type: 'team'}];
      const users: UserParticipant[] = [
        {
          ...UserFixture({
            id: '2',
            name: 'John Smith',
            email: 'johnsmith@example.com',
          }),
          type: 'user',
        },
        {
          ...UserFixture({
            id: '3',
            name: 'Sohn Jmith',
            email: 'sohnjmith@example.com',
          }),
          type: 'user',
        },
      ];

      const participantGroup = {
        ...group,
        participants: [...teams, ...users],
        seenBy: users,
      };

      render(
        <UpdatedGroupHeader
          {...defaultProps}
          group={participantGroup}
          project={project}
        />,
        {
          organization,
        }
      );

      expect(await screen.findByText('RequestError')).toBeInTheDocument();

      expect(await screen.findByText('First Seen in')).toBeInTheDocument();
      expect(await screen.findByText('Last Seen in')).toBeInTheDocument();

      expect(
        await screen.findByRole('button', {name: 'Modify issue priority'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('button', {name: 'Modify issue assignee'})
      ).toBeInTheDocument();

      expect(await screen.findByText('Participants')).toBeInTheDocument();
      expect(await screen.findByText('Viewers')).toBeInTheDocument();

      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
      expect(await screen.findByRole('button', {name: 'Archive'})).toBeInTheDocument();
    });
  });
});
