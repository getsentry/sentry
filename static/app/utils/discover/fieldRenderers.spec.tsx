import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {SPAN_OP_RELATIVE_BREAKDOWN_FIELD} from 'sentry/utils/discover/fields';
import {WidgetType, type DashboardFilters} from 'sentry/views/dashboards/types';

const theme = ThemeFixture();

describe('getFieldRenderer', () => {
  let location: any, context: any, project: any, organization: any, data: any, user: any;

  beforeEach(() => {
    context = initializeOrg({
      organization: OrganizationFixture({features: ['dashboards-drilldown-flow']}),
    });
    organization = context.organization;
    project = context.project;
    act(() => ProjectsStore.loadInitialData([project]));
    user = 'email:text@example.com';

    location = {
      pathname: '/events',
      query: {},
    };
    data = {
      id: '1',
      team_key_transaction: 1,
      title: 'ValueError: something bad',
      transaction: 'api.do_things',
      boolValue: 1,
      numeric: 1.23,
      createdAt: new Date(2019, 9, 3, 12, 13, 14),
      url: '/example',
      project: project.slug,
      release: 'F2520C43515BD1F0E8A6BD46233324641A370BF6',
      issue: 'SENTRY-T6P',
      user,
      'span_ops_breakdown.relative': '',
      'spans.browser': 10,
      'spans.db': 30,
      'spans.http': 15,
      'spans.resource': 20,
      'spans.total.time': 75,
      'transaction.duration': 75,
      'timestamp.to_day': '2021-09-05T00:00:00+00:00',
      'issue.id': '123214',
      'http_response_rate(3)': 0.012,
      'http_response_rate(5)': 0.000021,
      lifetimeCount: 10000,
      filteredCount: 3000,
      count: 6000,
      selectionDateString: 'last 7 days',
      'opportunity_score(measurements.score.total)': 0.0345,
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.slug}/`,
      body: project,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/key-transactions/`,
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/key-transactions/`,
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
  });

  it('can render string fields', () => {
    const renderer = getFieldRenderer('url', {url: 'string'});
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText(data.url)).toBeInTheDocument();
  });

  it('can render empty string fields', () => {
    const renderer = getFieldRenderer('url', {url: 'string'});
    data.url = '';
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText('(empty string)')).toBeInTheDocument();
  });

  it('can render boolean fields', () => {
    const renderer = getFieldRenderer('boolValue', {boolValue: 'boolean'});
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('can render integer fields', () => {
    const renderer = getFieldRenderer('numeric', {numeric: 'integer'});
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText(data.numeric)).toBeInTheDocument();
  });

  it('can render dashboard links', () => {
    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
      queries: [
        {
          linkedDashboards: [{dashboardId: '123', field: 'transaction'}],
          aggregates: [],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
        },
      ],
    });
    const dashboardFilters: DashboardFilters = {};

    const renderer = getFieldRenderer(
      'transaction',
      {transaction: 'string'},
      undefined,
      widget,
      dashboardFilters
    );

    render(
      renderer(data, {
        location,
        organization,
        theme,
      }) as React.ReactElement<any, any>
    );

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/123/?globalFilter=%7B%22dataset%22%3A%22spans%22%2C%22tag%22%3A%7B%22key%22%3A%22transaction%22%2C%22name%22%3A%22transaction%22%2C%22kind%22%3A%22tag%22%7D%2C%22value%22%3A%22transaction%3A%5Bapi.do_things%5D%22%2C%22isTemporary%22%3Atrue%7D'
    );
  });

  describe('rate', () => {
    it('can render null rate', () => {
      const renderer = getFieldRenderer(
        'per_second(value)',
        {
          'per_second(value)': 'rate',
        },
        false
      );

      render(
        renderer(
          {'per_second(value)': null},
          {location, organization, theme}
        ) as React.ReactElement<any, any>
      );
      expect(screen.getByText('(no value)')).toBeInTheDocument();
    });

    it('can render low rate', () => {
      const renderer = getFieldRenderer(
        'per_second(value)',
        {
          'per_second(value)': 'rate',
        },
        false
      );

      render(
        renderer(
          {'per_second(value)': 0.0001},
          {location, organization, theme}
        ) as React.ReactElement<any, any>
      );
      expect(screen.getByText('<0.01/s')).toBeInTheDocument();
    });

    it('can render high rate', () => {
      const renderer = getFieldRenderer(
        'per_second(value)',
        {
          'per_second(value)': 'rate',
        },
        false
      );

      render(
        renderer(
          {'per_second(value)': 10},
          {location, organization, theme}
        ) as React.ReactElement<any, any>
      );
      expect(screen.getByText('10.0/s')).toBeInTheDocument();
    });
  });

  describe('percentage', () => {
    it('can render percentage fields', () => {
      const renderer = getFieldRenderer(
        'http_response_rate(3)',
        {
          'http_response_rate(3)': 'percentage',
        },
        false
      );

      render(
        renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
      );
      expect(screen.getByText('1.2%')).toBeInTheDocument();
    });

    it('can render very small percentages', () => {
      const renderer = getFieldRenderer(
        'http_response_rate(5)',
        {
          'http_response_rate(5)': 'percentage',
        },
        false
      );

      render(
        renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
      );
      expect(screen.getByText('<0.01%')).toBeInTheDocument();
    });
  });

  describe('date', () => {
    it('can render date fields', async () => {
      const renderer = getFieldRenderer('createdAt', {createdAt: 'date'});
      render(
        renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
      );

      await screen.findByText('Oct 3, 2019 4:13:14 PM UTC');
    });

    it('can render date fields using utc when query string has utc set to true', async () => {
      const renderer = getFieldRenderer('createdAt', {createdAt: 'date'});
      render(
        renderer(data, {
          location: {...location, query: {utc: 'true'}},
          organization,
          theme,
        }) as React.ReactElement<any, any>
      );

      await screen.findByText('Oct 3, 2019 4:13:14 PM UTC');
    });
  });

  it('can render null date fields', () => {
    const renderer = getFieldRenderer('nope', {nope: 'date'});
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText('(no value)')).toBeInTheDocument();
  });

  it('can render timestamp.to_day', () => {
    const renderer = getFieldRenderer('timestamp.to_day', {'timestamp.to_day': 'date'});
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText('Sep 5, 2021')).toBeInTheDocument();
  });

  it('can render error.handled values', () => {
    const renderer = getFieldRenderer('error.handled', {'error.handled': 'boolean'});

    function validate(value: any, expectText: any) {
      const {unmount} = render(
        renderer(
          {'error.handled': value},
          {location, organization, theme}
        ) as React.ReactElement<any, any>
      );
      expect(screen.getByText(expectText)).toBeInTheDocument();
      unmount();
    }

    // Should render the same as the filter.
    // ie. all 1 or null
    validate([0, 1], 'false');
    validate([1, 0], 'false');
    validate([null, 0], 'false');
    validate([0, null], 'false');
    validate([null, 1], 'true');
    validate([1, null], 'true');

    // null = true for error.handled data.
    validate([null], 'true');

    // Default events won't have error.handled and will return an empty list.
    validate([], '(no value)');

    // Transactions will have null for error.handled as the 'tag' won't be set.
    validate(null, '(no value)');
  });

  it('can render user fields with aliased user', () => {
    const renderer = getFieldRenderer('user', {user: 'string'});

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByText('text@example.com')).toBeInTheDocument();
  });

  it('can render null user fields', () => {
    const renderer = getFieldRenderer('user', {user: 'string'});

    delete data.user;
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.queryByTestId('letter_avatar-avatar')).not.toBeInTheDocument();
    expect(screen.getByText('(no value)')).toBeInTheDocument();
  });

  it('can render null release fields', () => {
    const renderer = getFieldRenderer('release', {release: 'string'});

    delete data.release;
    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText('(no value)')).toBeInTheDocument();
  });

  it('renders release version with hyperlink', () => {
    const renderer = getFieldRenderer('release', {release: 'string'});

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.queryByRole('link')).toHaveAttribute(
      'href',
      '/mock-pathname/?rd=show&rdRelease=F2520C43515BD1F0E8A6BD46233324641A370BF6&rdSource=release-version-link'
    );
    expect(screen.getByText('F2520C43515B')).toBeInTheDocument();
  });

  it('renders issue hyperlink', () => {
    const renderer = getFieldRenderer('issue', {issue: 'string'});

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.queryByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/123214/`
    );
    expect(screen.getByText('SENTRY-T6P')).toBeInTheDocument();
  });

  it('can render project as an avatar', () => {
    const renderer = getFieldRenderer('project', {project: 'string'});

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.queryByTestId('letter_avatar-avatar')).not.toBeInTheDocument();
    expect(screen.getByText(project.slug)).toBeInTheDocument();
  });

  it('can render project id as an avatar', () => {
    const renderer = getFieldRenderer('project', {project: 'number'});

    data = {...data, project: parseInt(project.id, 10)};

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.queryByTestId('letter_avatar-avatar')).not.toBeInTheDocument();
    expect(screen.getByText(project.slug)).toBeInTheDocument();
  });

  it('can render team key transaction as a star with the dropdown', async () => {
    const renderer = getFieldRenderer('team_key_transaction', {
      team_key_transaction: 'boolean',
    });

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    const star = screen.getByRole('button', {name: 'Toggle star for team'});

    // Enabled, can't open the menu in the test without setting up the
    // TeamKeyTransactionManager
    await waitFor(() => expect(star).toBeEnabled());
  });

  it('can render team key transaction as a star without the dropdown', () => {
    const renderer = getFieldRenderer('team_key_transaction', {
      team_key_transaction: 'boolean',
    });
    delete data.project;

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    const star = screen.getByRole('button', {name: 'Toggle star for team'});

    // Not enabled without a project
    expect(star).toBeDisabled();
  });

  describe('ops breakdown', () => {
    const getWidths = () =>
      Array.from(screen.getByTestId('relative-ops-breakdown').children).map(
        node => (node as HTMLElement).style.width
      );

    it('can render operation breakdowns', () => {
      const renderer = getFieldRenderer(SPAN_OP_RELATIVE_BREAKDOWN_FIELD, {
        [SPAN_OP_RELATIVE_BREAKDOWN_FIELD]: 'string',
      });

      render(
        renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
      );

      expect(getWidths()).toEqual(['13.333%', '40%', '20%', '26.667%', '0%']);
    });

    it('renders operation breakdowns in sorted order when a sort field is provided', () => {
      const renderer = getFieldRenderer(SPAN_OP_RELATIVE_BREAKDOWN_FIELD, {
        [SPAN_OP_RELATIVE_BREAKDOWN_FIELD]: 'string',
      });

      render(
        renderer(data, {
          location,
          organization,
          theme,
          eventView: new EventView({
            sorts: [{field: 'spans.db', kind: 'desc'}],
            createdBy: UserFixture(),
            display: undefined,
            end: undefined,
            start: undefined,
            id: undefined,
            name: undefined,
            project: [],
            query: '',
            statsPeriod: undefined,
            environment: [],
            fields: [{field: 'spans.db'}],
            team: [],
            topEvents: undefined,
          }),
        }) as React.ReactElement<any, any>
      );

      expect(getWidths()).toEqual(['40%', '13.333%', '20%', '26.667%', '0%']);
    });
  });

  it('renders opportunity score', () => {
    const renderer = getFieldRenderer('opportunity_score(measurements.score.total)', {
      'opportunity_score(measurements.score.total)': 'score',
    });

    render(
      renderer(data, {location, organization, theme}) as React.ReactElement<any, any>
    );

    expect(screen.getByText('3.45')).toBeInTheDocument();
  });
});
