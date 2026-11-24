import {ActorFixture} from 'sentry-fixture/actor';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {mockTour} from 'sentry/components/tours/testUtils';
import {IssueCategory, ProgressState} from 'sentry/types/group';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

import {GroupHeader} from './header';

jest.mock('sentry/utils/useFeedbackForm', () => ({useFeedbackForm: () => jest.fn()}));

jest.mock('sentry/views/issueDetails/issueDetailsTour', () => ({
  ...jest.requireActual('sentry/views/issueDetails/issueDetailsTour'),
  useIssueDetailsTour: () => mockTour(),
}));

describe('GroupHeader', () => {
  const baseUrl = 'BASE_URL/';
  const organization = OrganizationFixture();
  const project = ProjectFixture({platform: 'javascript', teams: [TeamFixture()]});
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
      MockApiClient.addMockResponse({url: '/organizations/org-slug/repos/', body: {}});
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
        {organization}
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

    it('shows the impact assessment between priority and assignee', async () => {
      const impactGroup = GroupFixture({
        ...group,
        derivedData: {
          hasOpenFixPr: false,
          hasRootCause: false,
          isAssigned: true,
          lastProgressedAt: null,
          progress: ProgressState.IDENTIFIED,
          status: 'open',
          viewCount: 0,
          impact: {
            level: 'low',
            score: 20,
            description: 'Few users are affected.',
            citations: [],
            sourceEventId: 'event-id',
          },
        },
      });
      render(
        <GroupDataContextProvider group={impactGroup} project={impactGroup.project}>
          <GroupHeader
            {...defaultProps}
            group={impactGroup}
            project={project}
            event={null}
          />
        </GroupDataContextProvider>,
        {organization}
      );

      expect(await screen.findByText('Low (20)')).toBeInTheDocument();
      await userEvent.hover(screen.getByText('Low (20)'));
      expect(await screen.findByText('Few users are affected.')).toBeInTheDocument();
      expect(screen.getByText(/This issue has a/)).toHaveTextContent(
        'This issue has a Low impact on users'
      );
      expect(screen.getAllByRole('banner').at(-1)).toHaveTextContent(
        /Priority.*Impact\s*Low \(20\).*Assignee/
      );
    });

    it('renders the short-id crumb with an always-visible copy button', async () => {
      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <GroupHeader {...defaultProps} group={group} project={project} event={null} />
        </GroupDataContextProvider>,
        {organization}
      );

      expect(
        await screen.findByRole('button', {name: 'Copy Issue Short-ID'})
      ).toBeInTheDocument();
      expect(screen.getByText(group.shortId)).toBeInTheDocument();
    });

    it('renders colored title and message without escape codes when given ANSI metadata', async () => {
      const ansiGroup = GroupFixture({
        ...group,
        metadata: {
          type: '\x1B[31mRequestError\x1B[0m',
          value: '\x1B[33mGET\x1B[0m /api failed',
        },
      });

      render(
        <GroupDataContextProvider group={ansiGroup} project={ansiGroup.project}>
          <GroupHeader
            {...defaultProps}
            group={ansiGroup}
            project={project}
            event={null}
          />
        </GroupDataContextProvider>,
        {organization}
      );

      expect(await screen.findByRole('link', {name: 'View events'})).toBeInTheDocument();
      expect(screen.getByText('RequestError').style.color).toContain(
        'color-mix(in srgb,'
      );
      expect(screen.getByText('GET').style.color).toContain('color-mix(in srgb,');
      expect(screen.getByText('GET').parentElement).toHaveTextContent(
        /^GET \/api failed$/
      );
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
        {organization}
      );

      expect(
        await screen.findByRole('button', {name: 'View issue share settings'})
      ).toBeInTheDocument();
    });
  });
});
