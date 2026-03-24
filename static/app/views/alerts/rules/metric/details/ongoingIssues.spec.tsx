import {GroupFixture} from 'sentry-fixture/group';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricAlertOngoingIssues} from 'sentry/views/alerts/rules/metric/details/ongoingIssues';

describe('MetricAlertOngoingIssues', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/users/`,
      body: [],
    });
  });

  it('renders ongoing issues using detector id', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '2'});
    const rule = MetricRuleFixture({id: '101'});

    const detectorRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rule-detector/`,
      body: {alertRuleId: rule.id, detectorId: '555', ruleId: rule.id},
      match: [MockApiClient.matchQuery({alert_rule_id: rule.id})],
    });

    const issuesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [GroupFixture()],
      match: [
        MockApiClient.matchQuery({
          query: 'detector:555',
          project: project.id,
        }),
      ],
    });

    render(<MetricAlertOngoingIssues project={project} rule={rule} />, {organization});

    expect(await screen.findByTestId('group')).toBeInTheDocument();
    expect(detectorRequest).toHaveBeenCalled();
    expect(issuesRequest).toHaveBeenCalled();
  });

  it('renders an empty state when detector id is unavailable', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '2'});
    const rule = MetricRuleFixture({id: '101'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rule-detector/`,
      body: null,
      match: [MockApiClient.matchQuery({alert_rule_id: rule.id})],
    });

    render(<MetricAlertOngoingIssues project={project} rule={rule} />, {organization});

    expect(await screen.findByText('No ongoing issues.')).toBeInTheDocument();
  });
});
