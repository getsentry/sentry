import {GroupFixture} from 'sentry-fixture/group';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import RelatedIssues from './relatedIssues';

describe('metric details -> RelatedIssues', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();

  it('adds environment to query parameters', async () => {
    const rule = MetricRuleFixture({
      projects: [project.slug],
      environment: 'production',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2017-10-17T02%3A41%3A20.000Z&environment=production&groupStatsPeriod=auto&limit=5&project=2&sort=freq&start=2017-10-17T02%3A41%3A20.000Z',
      body: [GroupFixture()],
    });

    const {router} = render(
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
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {environment: 'test-env'},
          },
        },
      }
    );

    expect(await screen.findByTestId('group')).toBeInTheDocument();

    // The component's useEffect replaces the environment query param with the rule's environment
    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/mock-pathname/',
          query: {environment: 'production'},
        })
      );
    });

    // The link should now contain the updated environment from the router
    expect(screen.getByRole('link', {name: /RequestError/})).toHaveAttribute(
      'href',
      expect.stringContaining('environment=production')
    );
  });
});
