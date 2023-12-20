import {Group} from 'sentry-fixture/group';
import {MetricRule} from 'sentry-fixture/metricRule';
import {Project} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import RelatedIssues from './relatedIssues';

describe('metric details -> RelatedIssues', () => {
  const project = Project();

  it('adds environment to query parameters', async () => {
    const {routerContext, organization, router} = initializeOrg({
      router: {
        location: {
          pathname: '/mock-pathname/',
          query: {environment: 'test-env'},
        },
      },
    });
    const rule = MetricRule({
      projects: [project.slug],
      environment: 'production',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2017-10-17T02%3A41%3A20.000Z&environment=production&groupStatsPeriod=auto&limit=5&project=2&sort=freq&start=2017-10-17T02%3A41%3A20.000Z',
      body: [Group()],
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
      {context: routerContext, organization}
    );

    expect(await screen.findByTestId('group')).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/mock-pathname/',
      query: {
        environment: 'production',
      },
    });
    // The links should contain the query parameters, our test environment isn't able to update it
    expect(
      screen.getByRole('link', {name: /Level: Warning RequestError fetchData/})
    ).toHaveAttribute('href', expect.stringContaining('environment=test-env'));
  });
});
