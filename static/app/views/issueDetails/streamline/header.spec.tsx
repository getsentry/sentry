import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {TeamParticipant, UserParticipant} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import StreamlinedGroupHeader from 'sentry/views/issueDetails/streamline/header';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

describe('UpdatedGroupHeader', () => {
  const baseUrl = 'BASE_URL/';
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    platform: 'javascript',
    teams: [TeamFixture()],
  });
  const group = GroupFixture({issueCategory: IssueCategory.ERROR, isUnhandled: true});
  const location = LocationFixture({query: {streamline: '1'}});

  describe('JS Project Error Issue', () => {
    const defaultProps = {
      organization,
      baseUrl,
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

    const firstRelease = ReleaseFixture({id: '1'});
    const lastRelease = ReleaseFixture({id: '2'});

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/replay-count/',
        body: {},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/repos/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(firstRelease.version)}/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/releases/${encodeURIComponent(firstRelease.version)}/deploys/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
        body: [],
      });
    });

    it('shows all elements of header', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
        method: 'GET',
        body: {firstRelease, lastRelease},
      });
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
          router: {location},
        }
      );

      expect(screen.getByText('RequestError')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Unhandled')).toBeInTheDocument();
      expect(await screen.findByTestId('all-event-count')).toHaveTextContent(
        'All Events'
      );
      expect(
        await screen.findByRole('link', {name: formatAbbreviatedNumber(group.count)})
      ).toBeInTheDocument();
      expect(await screen.findByText('All Users')).toBeInTheDocument();
      expect(
        await screen.findByRole('link', {name: formatAbbreviatedNumber(group.userCount)})
      ).toBeInTheDocument();

      expect(
        await screen.findByText(textWithMarkupMatcher('Releases'))
      ).toBeInTheDocument();

      expect(
        screen.getByRole('button', {name: 'Modify issue priority'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Modify issue assignee'})
      ).toBeInTheDocument();

      expect(screen.getByText('Participants')).toBeInTheDocument();
      expect(screen.getByText('Viewers')).toBeInTheDocument();

      expect(
        screen.queryByRole('button', {name: 'Switch to the old issue experience'})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Resolve'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    });

    it('only shows one release if possible', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
        method: 'GET',
        // First and last release match
        body: {firstRelease, lastRelease: firstRelease},
      });
      render(
        <StreamlinedGroupHeader {...defaultProps} group={group} project={project} />,
        {
          organization,
          router: {location},
        }
      );
      expect(
        await screen.findByText(textWithMarkupMatcher('Release'))
      ).toBeInTheDocument();
    });

    it('displays new experience button if flag is set', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
        method: 'GET',
        body: {firstRelease, lastRelease},
      });
      const flaggedOrganization = OrganizationFixture({
        features: ['issue-details-streamline'],
      });
      render(
        <StreamlinedGroupHeader {...defaultProps} group={group} project={project} />,
        {
          organization: flaggedOrganization,
          router: {location},
        }
      );
      expect(
        await screen.findByRole('button', {name: 'Switch to the old issue experience'})
      ).toBeInTheDocument();
    });
  });
});
