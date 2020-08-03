import {mount, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';

describe('getFieldRenderer', function() {
  let location, context, project, organization, data, user, userAlias;
  beforeEach(function() {
    context = initializeOrg({
      project: TestStubs.Project(),
    });
    organization = context.organization;
    project = context.project;
    user = TestStubs.User();
    userAlias = user.email || user.username || user.ip || user.id;

    location = {
      pathname: '/events',
      query: {},
    };
    data = {
      title: 'ValueError: something bad',
      transaction: 'api.do_things',
      boolValue: 1,
      numeric: 1.23,
      createdAt: new Date(2019, 9, 3, 12, 13, 14),
      url: '/example',
      latest_event: 'deadbeef',
      project: project.slug,
      user: userAlias,
      release: 'F2520C43515BD1F0E8A6BD46233324641A370BF6',
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.slug}/`,
      body: project,
    });
  });

  it('can render string fields', function() {
    const renderer = getFieldRenderer('url', {url: 'string'});
    const wrapper = mount(renderer(data, {location, organization}));
    const text = wrapper.find('Container');
    expect(text.text()).toEqual(data.url);
  });

  it('can render boolean fields', function() {
    const renderer = getFieldRenderer('boolValue', {boolValue: 'boolean'});
    const wrapper = mount(renderer(data, {location, organization}));
    const text = wrapper.find('Container');
    expect(text.text()).toEqual('yes');
  });

  it('can render integer fields', function() {
    const renderer = getFieldRenderer('numeric', {numeric: 'integer'});
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('Count');
    expect(value).toHaveLength(1);
    expect(value.props().value).toEqual(data.numeric);
  });

  it('can render date fields', function() {
    const renderer = getFieldRenderer('createdAt', {createdAt: 'date'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(1);
    expect(value.props().date).toEqual(data.createdAt);
  });

  it('can render null date fields', function() {
    const renderer = getFieldRenderer('nope', {nope: 'date'});
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(0);
    expect(wrapper.text()).toEqual('n/a');
  });

  it('can render user fields with aliased user', function() {
    const renderer = getFieldRenderer('user', {user: 'string'});

    const wrapper = mount(renderer(data, {location, organization}));

    const badge = wrapper.find('UserBadge');
    expect(badge).toHaveLength(1);

    const value = wrapper.find('StyledNameAndEmail');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual(userAlias);
  });

  it('can render null user fields', function() {
    const renderer = getFieldRenderer('user', {user: 'string'});

    delete data.user;
    const wrapper = mount(renderer(data, {location, organization}));

    const badge = wrapper.find('UserBadge');
    expect(badge).toHaveLength(0);

    const value = wrapper.find('EmptyValueContainer');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual('n/a');
  });

  it('can render null release fields', function() {
    const renderer = getFieldRenderer('release', {release: 'string'});

    delete data.release;
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('EmptyValueContainer');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual('n/a');
  });

  it('can render project as an avatar', function() {
    const renderer = getFieldRenderer('project', {project: 'string'});

    const wrapper = mountWithTheme(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const value = wrapper.find('ProjectBadge');
    expect(value).toHaveLength(1);
    expect(value.text()).toEqual(project.slug);
  });
});
