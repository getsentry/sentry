import {ActorFixture} from 'sentry-fixture/actor';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {mockTour} from 'sentry/components/tours/testUtils';
import {IssueCategory} from 'sentry/types/group';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';
import {GroupHeader} from 'sentry/views/issueDetails/header/header';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => jest.fn(),
}));

jest.mock('sentry/views/issueDetails/issueDetailsTour', () => ({
  ...jest.requireActual('sentry/views/issueDetails/issueDetailsTour'),
  useIssueDetailsTour: () => mockTour(),
}));

describe('GroupHeader', () => {
  const baseUrl = 'BASE_URL/';
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    platform: 'javascript',
    teams: [TeamFixture()],
  });
  const group = GroupFixture({
    issueCategory: IssueCategory.ERROR,
    isUnhandled: true,
    assignedTo: ActorFixture({
      id: '101',
      email: 'leander.rodrigues@sentry.io',
      name: 'Leander',
    }),
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
        url: '/organizations/org-slug/repos/',
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
        <GroupDataContextProvider group={group} project={group.project}>
          <GroupHeader {...defaultProps} group={group} project={project} event={null} />
        </GroupDataContextProvider>,
        {
          organization,
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
      expect(screen.getByText('Leander')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Resolve'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    });

    it('renders the short-id crumb with an always-visible copy button (flag on)', async () => {
      const flaggedOrg = OrganizationFixture({
        features: ['ui-migration-breadcrumbs'],
      });
      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <GroupHeader {...defaultProps} group={group} project={project} event={null} />
        </GroupDataContextProvider>,
        {
          organization: flaggedOrg,
        }
      );

      expect(
        await screen.findByRole('button', {name: 'Copy Issue Short-ID'})
      ).toBeInTheDocument();
      expect(screen.getByText(group.shortId)).toBeInTheDocument();
    });

    it('displays share icon if issue has been shared', async () => {
      render(
        <GroupDataContextProvider
          group={{...group, isPublic: true, shareId: 'abc123'}}
          project={project}
        >
          <GroupHeader
            {...defaultProps}
            group={{...group, isPublic: true, shareId: 'abc123'}}
            project={project}
            event={null}
          />
        </GroupDataContextProvider>,
        {
          organization,
        }
      );

      expect(
        await screen.findByRole('button', {name: 'View issue share settings'})
      ).toBeInTheDocument();
    });
  });
});
