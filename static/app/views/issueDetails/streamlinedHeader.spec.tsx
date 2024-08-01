import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {TeamParticipant, UserParticipant} from 'sentry/types';
import {IssueCategory} from 'sentry/types';
import StreamlinedGroupHeader from 'sentry/views/issueDetails/streamlinedHeader';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

describe('UpdatedGroupHeader', () => {
  const baseUrl = 'BASE_URL/';
  const organization = OrganizationFixture({features: ['issue-details-streamline']});
  const project = ProjectFixture({
    platform: 'javascript',
    teams: [TeamFixture()],
  });
  const group = GroupFixture({issueCategory: IssueCategory.ERROR, isUnhandled: true});

  describe('JS Project Error Issue', () => {
    const defaultProps = {
      organization,
      baseUrl,
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

    const release = ReleaseFixture();

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
        method: 'GET',
        body: {firstRelease: release, lastRelease: release},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/replay-count/',
        body: {},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/repos/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(release.version)}/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/releases/${encodeURIComponent(release.version)}/deploys/`,
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
        <StreamlinedGroupHeader
          {...defaultProps}
          group={participantGroup}
          project={project}
        />,
        {
          organization,
        }
      );

      expect(await screen.findByText('RequestError')).toBeInTheDocument();

      expect(await screen.findByText('Warning')).toBeInTheDocument();
      expect(await screen.findByText('Unhandled')).toBeInTheDocument();

      expect(
        await screen.findByText(textWithMarkupMatcher('Releases'))
      ).toBeInTheDocument();

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
