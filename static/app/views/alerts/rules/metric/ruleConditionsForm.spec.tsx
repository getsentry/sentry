import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import RuleConditionsForm from 'sentry/views/alerts/rules/metric/ruleConditionsForm';
import {AlertRuleComparisonType, Dataset} from 'sentry/views/alerts/rules/metric/types';
import type {AlertType} from 'sentry/views/alerts/wizard/options';

describe('RuleConditionsForm', () => {
  it('searches with new searchbar (search-query-builder-alerts)', async () => {
    const {organization, projects, router} = initializeOrg({
      organization: {features: ['search-query-builder-alerts']},
    });
    ProjectsStore.loadInitialData(projects);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [],
    });

    const mockSearch = jest.fn();

    const props = {
      aggregate: 'foo',
      alertType: 'errors' as AlertType,
      comparisonType: AlertRuleComparisonType.COUNT,
      dataset: Dataset.ERRORS,
      disabled: false,
      isEditing: true,
      onComparisonDeltaChange: _ => {},
      onFilterSearch: mockSearch,
      onMonitorTypeSelect: _ => {},
      onTimeWindowChange: _ => {},
      project: projects[0],
      thresholdChart: <div>chart</div>,
      timeWindow: 30,
    };
    render(
      <RuleConditionsForm {...props} organization={organization} router={router} />,
      {
        router,
        organization: {...organization, features: ['search-query-builder-alerts']},
      }
    );
    const input = await screen.findByPlaceholderText(
      'Filter events by level, message, and other properties\u2026'
    );
    expect(input).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'a{enter}');

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('a', true);
  });
});
