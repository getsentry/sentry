import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types/group';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import StreamlinedGroupHeader from 'sentry/views/issueDetails/streamline/header/header';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

describe('StreamlinedGroupHeader', () => {
  const baseUrl = 'BASE_URL/';
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    platform: 'javascript',
    teams: [TeamFixture()],
  });
  const group = GroupFixture({issueCategory: IssueCategory.ERROR, isUnhandled: true});
  const router = RouterFixture({
    location: LocationFixture({query: {streamline: '1'}}),
  });

  describe('JS Project Error Issue', () => {
    const defaultProps = {
      organization,
      baseUrl,
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

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
        url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/users/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
        body: TagsFixture(),
        method: 'GET',
      });
    });

    it('shows all elements of header', async () => {
      render(
        <StreamlinedGroupHeader
          {...defaultProps}
          group={group}
          project={project}
          event={null}
        />,
        {
          organization,
          router,
        }
      );

      expect(screen.getByText('RequestError')).toBeInTheDocument();
      expect(screen.getByText('Unhandled')).toBeInTheDocument();
      expect(await screen.findByRole('link', {name: 'View events'})).toBeInTheDocument();
      expect(screen.getByText(formatAbbreviatedNumber(group.count))).toBeInTheDocument();
      expect(
        await screen.findByRole('link', {name: 'View affected users'})
      ).toBeInTheDocument();
      expect(
        screen.getByText(formatAbbreviatedNumber(group.userCount))
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Modify issue priority'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Modify issue assignee'})
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('button', {name: 'Switch to the old issue experience'})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Resolve'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    });

    it('displays new experience button if flag is set', async () => {
      const flaggedOrganization = OrganizationFixture({
        features: ['issue-details-streamline'],
      });
      render(
        <StreamlinedGroupHeader
          {...defaultProps}
          group={group}
          project={project}
          event={null}
        />,
        {
          organization: flaggedOrganization,
          router,
        }
      );
      expect(
        await screen.findByRole('button', {name: 'Switch to the old issue experience'})
      ).toBeInTheDocument();
    });

    it('displays share icon if issue has been shared', async () => {
      render(
        <StreamlinedGroupHeader
          {...defaultProps}
          group={{...group, isPublic: true, shareId: 'abc123'}}
          project={project}
          event={null}
        />,
        {
          organization,
          router,
        }
      );

      expect(
        await screen.findByRole('button', {name: 'View issue share settings'})
      ).toBeInTheDocument();
    });
  });
});
