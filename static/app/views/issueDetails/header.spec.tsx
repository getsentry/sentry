import {browserHistory} from 'react-router';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types';
import GroupHeader from 'sentry/views/issueDetails/header';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

describe('groupDetails', () => {
  const baseUrl = 'BASE_URL/';
  const organization = Organization();
  const project = ProjectFixture({
    teams: [Team()],
  });

  describe('issue category: error, js project', () => {
    const defaultProps = {
      organization,
      baseUrl,
      group: GroupFixture({issueCategory: IssueCategory.ERROR}),
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

    it('displays the correct tabs with all features enabled', async () => {
      const orgWithFeatures = Organization({
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
        {organization: orgWithFeatures}
      );

      await userEvent.click(screen.getByRole('tab', {name: /details/i}));
      expect(browserHistory.push).toHaveBeenLastCalledWith('BASE_URL/');

      await userEvent.click(screen.getByRole('tab', {name: /activity/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/activity/');

      await userEvent.click(screen.getByRole('tab', {name: /user feedback/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/feedback/');

      await userEvent.click(screen.getByRole('tab', {name: /attachments/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/attachments/');

      await userEvent.click(screen.getByRole('tab', {name: /tags/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/tags/');

      await userEvent.click(screen.getByRole('tab', {name: /all events/i}));
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/events/',
        query: {},
      });

      await userEvent.click(screen.getByRole('tab', {name: /merged issues/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/merged/');

      await userEvent.click(screen.getByRole('tab', {name: /replays/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/replays/');

      expect(screen.queryByRole('tab', {name: /replays/i})).toBeInTheDocument();
    });
  });

  describe('issue category: error, mobile project', () => {
    const defaultProps = {
      organization,
      baseUrl,
      group: GroupFixture({issueCategory: IssueCategory.ERROR}),
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

    it('displays the correct tabs with all features enabled', async () => {
      const orgWithFeatures = Organization({
        features: ['similarity-view', 'event-attachments', 'session-replay'],
      });
      const mobileProjectWithSimilarityView = ProjectFixture({
        features: ['similarity-view'],
        platform: 'apple-ios',
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
        {organization: orgWithFeatures}
      );

      await userEvent.click(screen.getByRole('tab', {name: /similar issues/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/similar/');

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
    };

    it('displays the correct tabs with all features enabled', async () => {
      const orgWithFeatures = Organization({
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
        {organization: orgWithFeatures}
      );

      await userEvent.click(screen.getByRole('tab', {name: /details/i}));
      expect(browserHistory.push).toHaveBeenLastCalledWith('BASE_URL/');

      await userEvent.click(screen.getByRole('tab', {name: /tags/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/tags/');

      await userEvent.click(screen.getByRole('tab', {name: /sampled events/i}));
      expect(browserHistory.push).toHaveBeenCalledWith({
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
});
