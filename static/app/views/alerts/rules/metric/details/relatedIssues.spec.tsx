import {GroupFixture} from 'sentry-fixture/group';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {RelatedIssues} from './relatedIssues';

describe('metric details -> RelatedIssues', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();

  it('"Open in Issues" includes environment in the query params', async () => {
    const rule = MetricRuleFixture({
      projects: [project.slug],
      environment: 'production',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [GroupFixture()],
    });

    render(
      <RelatedIssues
        organization={organization}
        projects={[project]}
        rule={rule}
        timePeriod={{
          display: '',
          start: new Date().toISOString(),
          end: new Date().toISOString(),
          label: '',
          period: '1d',
          usingPeriod: true,
        }}
      />,
      {organization}
    );

    expect(await screen.findByTestId('group')).toBeInTheDocument();

    expect(screen.getByTestId('issues-open')).toHaveAttribute(
      'href',
      expect.stringContaining('environment=production')
    );
  });
});
