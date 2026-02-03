import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import RuleConditionsForm from 'sentry/views/alerts/rules/metric/ruleConditionsForm';
import {
  AlertRuleComparisonType,
  Dataset,
  EventTypes,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import type {AlertType} from 'sentry/views/alerts/wizard/options';

describe('RuleConditionsForm', () => {
  const {organization, projects, router} = initializeOrg({
    organization: {
      features: ['search-query-builder-alerts', 'visibility-explore-view'],
    },
  });
  ProjectsStore.loadInitialData(projects);

  const mockSearch = jest.fn();

  const props = {
    aggregate: 'foo',
    alertType: 'errors' as AlertType,
    comparisonType: AlertRuleComparisonType.COUNT,
    dataset: Dataset.ERRORS,
    disabled: false,
    isEditing: true,
    onComparisonDeltaChange: () => {},
    onFilterSearch: mockSearch,
    onTimeWindowChange: () => {},
    project: projects[0]!,
    thresholdChart: <div>chart</div>,
    timeWindow: 30,
  };

  beforeEach(() => {
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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('searches with new searchbar (search-query-builder-alerts)', async () => {
    render(
      <RuleConditionsForm
        {...props}
        eventTypes={[]}
        organization={organization}
        router={router}
      />,
      {
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

  it('renders low confidence warning', async () => {
    render(
      <RuleConditionsForm
        {...props}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        organization={organization}
        router={router}
        isLowConfidenceChartData
      />,
      {
        organization: {
          ...organization,
          features: ['search-query-builder-alerts', 'visibility-explore-view'],
        },
      }
    );
    await screen.findByPlaceholderText(
      'Filter events by level, message, and other properties\u2026'
    );
    expect(
      screen.getByText(
        'Your low sample count may impact the accuracy of this alert. Edit your query or increase your sampling rate.'
      )
    ).toBeInTheDocument();
  });

  it('renders extrapolation mode warning', async () => {
    render(
      <RuleConditionsForm
        {...props}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        dataset={Dataset.EVENTS_ANALYTICS_PLATFORM}
        extrapolationMode={ExtrapolationMode.SERVER_WEIGHTED}
        organization={organization}
        router={router}
        isLowConfidenceChartData
      />,
      {
        organization: {
          ...organization,
          features: ['search-query-builder-alerts', 'visibility-explore-view'],
        },
      }
    );

    await screen.findByPlaceholderText(
      'Filter transactions by URL, tags, and other properties\u2026'
    );
    expect(
      screen.getByText(/The thresholds on this chart may look off./)
    ).toBeInTheDocument();
  });
});
