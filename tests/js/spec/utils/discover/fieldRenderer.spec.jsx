import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ConfigStore from 'app/stores/configStore';
import ProjectsStore from 'app/stores/projectsStore';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {SPAN_OP_RELATIVE_BREAKDOWN_FIELD} from 'app/utils/discover/fields';

describe('getFieldRenderer', function () {
  let location, context, project, organization, data, user;

  beforeEach(function () {
    context = initializeOrg({
      project: TestStubs.Project(),
    });
    organization = context.organization;
    project = context.project;
    ProjectsStore.loadInitialData([project]);
    user = 'email:text@example.com';

    location = {
      pathname: '/events',
      query: {},
    };
    data = {
      key_transaction: 1,
      team_key_transaction: 1,
      title: 'ValueError: something bad',
      transaction: 'api.do_things',
      boolValue: 1,
      numeric: 1.23,
      createdAt: new Date(2019, 9, 3, 12, 13, 14),
      url: '/example',
      project: project.slug,
      release: 'F2520C43515BD1F0E8A6BD46233324641A370BF6',
      user,
      'span_ops_breakdown.relative': '',
      'spans.browser': 10,
      'spans.db': 30,
      'spans.http': 15,
      'spans.resource': 20,
      'spans.total.time': 75,
      'transaction.duration': 75,
      'timestamp.to_day': '2021-09-05T00:00:00+00:00',
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
  });

  it('can render string fields', function () {
    const renderer = getFieldRenderer('url', {url: 'string'});
    const wrapper = mountWithTheme(renderer(data, {location, organization}));
    const text = wrapper.find('Container');
    expect(text.text()).toEqual(data.url);
  });

  it('can render boolean fields', function () {
    const renderer = getFieldRenderer('boolValue', {boolValue: 'boolean'});
    const wrapper = mountWithTheme(renderer(data, {location, organization}));
    const text = wrapper.find('Container');
    expect(text.text()).toEqual('true');
  });

  it('can render integer fields', function () {
    const renderer = getFieldRenderer('numeric', {numeric: 'integer'});
    const wrapper = mountWithTheme(renderer(data, {location, organization}));

    const value = wrapper.find('Count');
    expect(value).toHaveLength(1);
    expect(value.props().value).toEqual(data.numeric);
  });

  it('can render date fields', function () {
    const renderer = getFieldRenderer('createdAt', {createdAt: 'date'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mountWithTheme(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(1);
    expect(value.props().date).toEqual(data.createdAt);
  });

  it('can render null date fields', function () {
    const renderer = getFieldRenderer('nope', {nope: 'date'});
    const wrapper = mountWithTheme(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(0);
    expect(wrapper.text()).toEqual('n/a');
  });

  it('can render timestamp.to_day', function () {
    // Set timezone
    ConfigStore.loadInitialData({
      user: {
        options: {
          timezone: 'America/Los_Angeles',
        },
      },
    });
    const renderer = getFieldRenderer('timestamp.to_day', {'timestamp.to_day': 'date'});
    const wrapper = mountWithTheme(renderer(data, {location, organization}));
    const text = wrapper.find('Container');
    expect(text.text()).toEqual('September 5, 2021');
  });

  it('can render error.handled values', function () {
    const renderer = getFieldRenderer('error.handled', {'error.handled': 'boolean'});

    // Should render the last value.
    let wrapper = mountWithTheme(
      renderer({'error.handled': [0, 1]}, {location, organization})
    );
    expect(wrapper.text()).toEqual('true');

    wrapper = mountWithTheme(
      renderer({'error.handled': [0, 0]}, {location, organization})
    );
    expect(wrapper.text()).toEqual('false');

    // null = true for error.handled data.
    wrapper = mountWithTheme(
      renderer({'error.handled': [null]}, {location, organization})
    );
    expect(wrapper.text()).toEqual('true');

    // Default events won't have error.handled and will return an empty list.
    wrapper = mountWithTheme(renderer({'error.handled': []}, {location, organization}));
    expect(wrapper.text()).toEqual('n/a');

    // Transactions will have null for error.handled as the 'tag' won't be set.
    wrapper = mountWithTheme(renderer({'error.handled': null}, {location, organization}));
    expect(wrapper.text()).toEqual('n/a');
  });

  it('can render user fields with aliased user', function () {
    const renderer = getFieldRenderer('user', {user: 'string'});

    const wrapper = mountWithTheme(renderer(data, {location, organization}));

    const badge = wrapper.find('UserBadge');
    expect(badge).toHaveLength(1);

    const value = wrapper.find('StyledNameAndEmail');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual('text@example.com');
  });

  it('can render null user fields', function () {
    const renderer = getFieldRenderer('user', {user: 'string'});

    delete data.user;
    const wrapper = mountWithTheme(renderer(data, {location, organization}));

    const badge = wrapper.find('UserBadge');
    expect(badge).toHaveLength(0);

    const value = wrapper.find('EmptyValueContainer');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual('n/a');
  });

  it('can render null release fields', function () {
    const renderer = getFieldRenderer('release', {release: 'string'});

    delete data.release;
    const wrapper = mountWithTheme(renderer(data, {location, organization}));

    const value = wrapper.find('EmptyValueContainer');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual('n/a');
  });

  it('can render project as an avatar', function () {
    const renderer = getFieldRenderer('project', {project: 'string'});

    const wrapper = mountWithTheme(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const value = wrapper.find('ProjectBadge');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual(project.slug);
  });

  it('can render key transaction as a star', async function () {
    const renderer = getFieldRenderer('key_transaction', {key_transaction: 'boolean'});
    delete data.project;

    const wrapper = mountWithTheme(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const value = wrapper.find('StyledKey');
    expect(value).toHaveLength(1);
    expect(value.props().isSolid).toBeTruthy();

    // Since there is not project column, it's not clickable
    expect(wrapper.find('KeyColumn')).toHaveLength(0);
  });

  it('can render key transaction as a clickable star', async function () {
    const renderer = getFieldRenderer('key_transaction', {key_transaction: 'boolean'});

    const wrapper = mountWithTheme(
      renderer(data, {location, organization}),
      context.routerContext
    );
    await tick();
    wrapper.update();

    let value;

    value = wrapper.find('StyledKey');
    expect(value).toHaveLength(1);
    expect(value.props().isSolid).toBeTruthy();

    wrapper.find('KeyColumn').simulate('click');
    await tick();
    wrapper.update();

    value = wrapper.find('StyledKey');
    expect(value).toHaveLength(1);
    expect(value.props().isSolid).toBeFalsy();

    wrapper.find('KeyColumn').simulate('click');
    await tick();
    wrapper.update();

    value = wrapper.find('StyledKey');
    expect(value).toHaveLength(1);
    expect(value.props().isSolid).toBeTruthy();
  });

  it('can render team key transaction as a star with the dropdown', async function () {
    const renderer = getFieldRenderer('team_key_transaction', {
      team_key_transaction: 'boolean',
    });

    const wrapper = mountWithTheme(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const value = wrapper.find('IconStar');
    expect(value).toHaveLength(1);
    expect(value.props().isSolid).toBeTruthy();

    expect(wrapper.find('TeamKeyTransaction')).toHaveLength(1);
  });

  it('can render team key transaction as a star without the dropdown', async function () {
    const renderer = getFieldRenderer('team_key_transaction', {
      team_key_transaction: 'boolean',
    });
    delete data.project;

    const wrapper = mountWithTheme(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const value = wrapper.find('IconStar');
    expect(value).toHaveLength(1);
    expect(value.props().isSolid).toBeTruthy();

    // Since there is no project column, it is not wrapped with the dropdown
    expect(wrapper.find('TeamKeyTransaction')).toHaveLength(0);
  });

  describe('ops breakdown', () => {
    const getWidth = (wrapper, index) =>
      wrapper.children().children().at(index).getDOMNode().style.width;

    it('can render operation breakdowns', async function () {
      const renderer = getFieldRenderer(SPAN_OP_RELATIVE_BREAKDOWN_FIELD, {
        [SPAN_OP_RELATIVE_BREAKDOWN_FIELD]: 'string',
      });

      const wrapper = mountWithTheme(
        renderer(data, {location, organization}),
        context.routerContext
      );

      const value = wrapper.find('RelativeOpsBreakdown');
      expect(value).toHaveLength(1);
      expect(getWidth(value, 0)).toEqual('20.000%');
      expect(getWidth(value, 1)).toEqual('40.000%');
      expect(getWidth(value, 2)).toEqual('13.333%');
      expect(getWidth(value, 3)).toEqual('26.667%');
    });

    it('renders operation breakdowns in sorted order when a sort field is provided', async function () {
      const renderer = getFieldRenderer(SPAN_OP_RELATIVE_BREAKDOWN_FIELD, {
        [SPAN_OP_RELATIVE_BREAKDOWN_FIELD]: 'string',
      });

      const wrapper = mountWithTheme(
        renderer(data, {
          location,
          organization,
          eventView: {sorts: [{field: 'spans.db'}]},
        }),
        context.routerContext
      );

      const value = wrapper.find('RelativeOpsBreakdown');
      expect(value).toHaveLength(1);
      expect(getWidth(value, 0)).toEqual('40.000%');
      expect(getWidth(value, 1)).toEqual('20.000%');
      expect(getWidth(value, 2)).toEqual('13.333%');
      expect(getWidth(value, 3)).toEqual('26.667%');
    });
  });
});
