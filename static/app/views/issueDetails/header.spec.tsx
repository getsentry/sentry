import {browserHistory} from 'react-router';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types';
import GroupHeader from 'sentry/views/issueDetails/header';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

describe('groupDetails', () => {
  const baseUrl = 'BASE_URL/';
  const organization = TestStubs.Organization();
  const project = TestStubs.Project({teams: [TestStubs.Team()]});

  describe('issue category: error', () => {
    const defaultProps = {
      organization,
      baseUrl,
      group: TestStubs.Group({issueCategory: IssueCategory.ERROR}),
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

    it('displays the correct tabs with all features enabled', () => {
      const orgWithFeatures = TestStubs.Organization({
        features: ['grouping-tree-ui', 'similarity-view', 'event-attachments'],
      });
      const projectWithSimilarityView = TestStubs.Project({
        features: ['similarity-view'],
      });

      render(
        <GroupHeader
          {...defaultProps}
          organization={orgWithFeatures}
          project={projectWithSimilarityView}
        />,
        {organization: orgWithFeatures}
      );

      userEvent.click(screen.getByRole('tab', {name: /details/i}));
      expect(browserHistory.push).toHaveBeenLastCalledWith('BASE_URL/');

      userEvent.click(screen.getByRole('tab', {name: /activity/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/activity/');

      userEvent.click(screen.getByRole('tab', {name: /user feedback/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/feedback/');

      userEvent.click(screen.getByRole('tab', {name: /attachments/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/attachments/');

      userEvent.click(screen.getByRole('tab', {name: /tags/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/tags/');

      userEvent.click(screen.getByRole('tab', {name: /all events/i}));
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/events/',
        query: {},
      });

      userEvent.click(screen.getByRole('tab', {name: /merged issues/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/merged/');

      userEvent.click(screen.getByRole('tab', {name: /grouping/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/grouping/');

      userEvent.click(screen.getByRole('tab', {name: /similar issues/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/similar/');
    });
  });

  describe('issue category: performance', () => {
    const defaultProps = {
      organization,
      baseUrl,
      group: TestStubs.Group({issueCategory: IssueCategory.PERFORMANCE}),
      groupReprocessingStatus: ReprocessingStatus.NO_STATUS,
      project,
    };

    it('displays the correct tabs with all features enabled', () => {
      const orgWithFeatures = TestStubs.Organization({
        features: ['grouping-tree-ui', 'similarity-view', 'event-attachments'],
      });

      const projectWithSimilarityView = TestStubs.Project({
        features: ['similarity-view'],
      });

      render(
        <GroupHeader
          {...defaultProps}
          organization={orgWithFeatures}
          project={projectWithSimilarityView}
        />,
        {organization: orgWithFeatures}
      );

      userEvent.click(screen.getByRole('tab', {name: /details/i}));
      expect(browserHistory.push).toHaveBeenLastCalledWith('BASE_URL/');

      userEvent.click(screen.getByRole('tab', {name: /tags/i}));
      expect(browserHistory.push).toHaveBeenCalledWith('BASE_URL/tags/');

      userEvent.click(screen.getByRole('tab', {name: /all events/i}));
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: 'BASE_URL/events/',
        query: {},
      });

      expect(screen.queryByRole('tab', {name: /user feedback/i})).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', {name: /attachments/i})).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', {name: /merged issues/i})).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', {name: /grouping/i})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('tab', {name: /similar issues/i})
      ).not.toBeInTheDocument();
    });
  });
});
