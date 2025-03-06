import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, PriorityLevel} from 'sentry/types/group';
import GroupHeader from 'sentry/views/issueDetails/header';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

describe('GroupHeader', () => {
  const baseUrl = 'BASE_URL/';
  const organization = OrganizationFixture();
  const {router} = initializeOrg();
  const project = ProjectFixture({
    teams: [TeamFixture()],
  });

  describe('issue category: error, js project', () => {
    const defaultProps = {
      organization,
      baseUrl,
      group: GroupFixture({issueCategory: IssueCategory.ERROR}),
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
      event: null,
    };

    it('displays the correct tabs with all features enabled', async () => {
      const orgWithFeatures = OrganizationFixture({
        features: ['similarity-view', 'event-attachments', 'session-replay'],
      });
      const jsProjectWithSimilarityView = ProjectFixture({
        features: ['similarity-view'],
        platform: 'javascript',
      });

      const MOCK_GROUP = GroupFixture();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/replay-count/`,
        method: 'GET',
        body: {
          [MOCK_GROUP.id]: ['replay42', 'replay256'],
        },
      });

      render(
        <GroupHeader
          {...defaultProps}
          organization={orgWithFeatures}
          project={jsProjectWithSimilarityView}
        />,
        {organization: orgWithFeatures, router}
      );

      await userEvent.click(screen.getByRole('tab', {name: /details/i}));
      expect(router.push).toHaveBeenLastCalledWith(
        expect.objectContaining({pathname: 'BASE_URL/'})
      );

      await userEvent.click(screen.getByRole('tab', {name: /activity/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/activity/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /user feedback/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/feedback/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /attachments/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/attachments/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /tags/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/tags/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /all events/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/events/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /merged issues/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/merged/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /replays/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/replays/',
        query: {},
      });

      expect(screen.getByRole('tab', {name: /replays/i})).toBeInTheDocument();
    });
  });

  describe('issue category: error, mobile project', () => {
    const defaultProps = {
      organization,
      baseUrl,
      group: GroupFixture({issueCategory: IssueCategory.ERROR}),
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
      event: null,
    };

    it('displays the correct tabs with all features enabled', async () => {
      const orgWithFeatures = OrganizationFixture({
        features: ['similarity-view', 'event-attachments', 'session-replay'],
      });
      const mobileProjectWithSimilarityView = ProjectFixture({
        features: ['similarity-view'],
        platform: 'unity',
      });

      const MOCK_GROUP = GroupFixture();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/replay-count/`,
        method: 'GET',
        body: {
          [MOCK_GROUP.id]: ['replay42', 'replay256'],
        },
      });

      render(
        <GroupHeader
          {...defaultProps}
          organization={orgWithFeatures}
          project={mobileProjectWithSimilarityView}
        />,
        {organization: orgWithFeatures, router}
      );

      await userEvent.click(screen.getByRole('tab', {name: /similar issues/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/similar/',
        query: {},
      });

      expect(screen.queryByRole('tab', {name: /replays/i})).not.toBeInTheDocument();
    });
  });

  describe('issue category: performance', () => {
    const defaultProps = {
      organization,
      baseUrl,
      group: GroupFixture({issueCategory: IssueCategory.PERFORMANCE}),
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
      event: null,
    };

    it('displays the correct tabs with all features enabled', async () => {
      const orgWithFeatures = OrganizationFixture({
        features: ['similarity-view', 'event-attachments', 'session-replay'],
      });

      const projectWithSimilarityView = ProjectFixture({
        features: ['similarity-view'],
      });

      const MOCK_GROUP = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/replay-count/`,
        method: 'GET',
        body: {
          [MOCK_GROUP.id]: ['replay42', 'replay256'],
        },
      });

      render(
        <GroupHeader
          {...defaultProps}
          organization={orgWithFeatures}
          project={projectWithSimilarityView}
        />,
        {organization: orgWithFeatures, router}
      );

      await userEvent.click(screen.getByRole('tab', {name: /details/i}));
      expect(router.push).toHaveBeenLastCalledWith(
        expect.objectContaining({pathname: 'BASE_URL/'})
      );

      await userEvent.click(screen.getByRole('tab', {name: /tags/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/tags/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /sampled events/i}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/events/',
        query: {},
      });

      expect(screen.queryByRole('tab', {name: /user feedback/i})).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', {name: /attachments/i})).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', {name: /merged issues/i})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('tab', {name: /similar issues/i})
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', {name: /replays/i})).not.toBeInTheDocument();
    });
  });

  describe('priority', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        body: {data: {dismissed_ts: null}},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/replay-count/',
        body: {},
      });
    });

    it('shows priority even if stats is off', async () => {
      render(
        <GroupHeader
          baseUrl=""
          organization={OrganizationFixture()}
          group={GroupFixture({
            priority: PriorityLevel.HIGH,
            // Setting an issue category where stats are turned off
            issueCategory: IssueCategory.UPTIME,
          })}
          project={ProjectFixture()}
          event={null}
        />
      );

      expect(await screen.findByText('Priority')).toBeInTheDocument();
      expect(await screen.findByText('High')).toBeInTheDocument();
    });

    it('can change priority', async () => {
      const mockModifyIssue = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/`,
        method: 'PUT',
        body: {},
      });

      render(
        <GroupHeader
          baseUrl=""
          organization={OrganizationFixture()}
          group={GroupFixture({priority: PriorityLevel.MEDIUM})}
          project={ProjectFixture()}
          event={null}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Modify issue priority'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'High'}));

      expect(mockModifyIssue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {priority: PriorityLevel.HIGH},
        })
      );
    });
  });
});
