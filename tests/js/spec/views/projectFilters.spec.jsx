import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectFilters from 'app/views/settings/project/projectFilters';

describe('ProjectFilters', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project({options: {}});
  const PROJECT_URL = `/projects/${org.slug}/${project.slug}/`;
  let wrapper;

  const getFilterEndpoint = filter => `${PROJECT_URL}filters/${filter}/`;

  const createFilterMock = filter =>
    MockApiClient.addMockResponse({
      url: getFilterEndpoint(filter),
      method: 'PUT',
    });

  const creator = custom => {
    if (custom) {
      wrapper = custom();
    } else {
      wrapper = mountWithTheme(
        <ProjectFilters
          params={{projectId: project.slug, orgId: org.slug}}
          location={{}}
        />,
        TestStubs.routerContext()
      );
    }

    return wrapper;
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: PROJECT_URL,
      body: project,
    });

    MockApiClient.addMockResponse({
      url: `${PROJECT_URL}stats/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `${PROJECT_URL}filters/`,
      body: TestStubs.ProjectFilters(),
    });

    MockApiClient.addMockResponse({
      url: `${PROJECT_URL}tombstones/`,
      body: TestStubs.Tombstones(),
    });

    creator();
  });

  it('has browser extensions enabled initially', function () {
    const filter = 'browser-extensions';
    const mock = createFilterMock(filter);
    const Switch = wrapper.find(`BooleanField[name="${filter}"] Switch`);

    expect(Switch.prop('isActive')).toBe(true);

    // Toggle filter on
    Switch.simulate('click');
    expect(mock).toHaveBeenCalledWith(
      getFilterEndpoint(filter),
      expect.objectContaining({
        method: 'PUT',
        data: {
          active: false,
        },
      })
    );
  });

  it('can toggle filters: localhost, web crawlers', function () {
    ['localhost', 'web-crawlers'].map(filter => {
      const mock = createFilterMock(filter);
      const Switch = wrapper.find(`BooleanField[name="${filter}"] Switch`);

      // Toggle filter on
      Switch.simulate('click');
      expect(mock).toHaveBeenCalledWith(
        getFilterEndpoint(filter),
        expect.objectContaining({
          method: 'PUT',
          data: {
            active: true,
          },
        })
      );
    });
  });

  it('has correct legacy browsers selected', function () {
    expect(wrapper.find('LegacyBrowserFilterRow Switch').at(0).prop('isActive')).toBe(
      true
    );
    expect(wrapper.find('LegacyBrowserFilterRow Switch').at(1).prop('isActive')).toBe(
      true
    );
    expect(wrapper.find('LegacyBrowserFilterRow Switch').at(2).prop('isActive')).toBe(
      false
    );
  });

  it('can toggle legacy browser', function () {
    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter);

    // default stubs ie_pre_9 and ie9 selected (first 2 switches)
    const Switch = wrapper.find('LegacyBrowserFilterRow Switch').at(4);

    // Toggle filter on
    Switch.simulate('click');
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    // Have to do this because no jest matcher for JS Set
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
      'safari_pre_6',
    ]);

    // Toggle filter off
    wrapper.find('LegacyBrowserFilterRow Switch').at(3).simulate('click');
    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
      'safari_pre_6',
      'ie11',
    ]);

    mock.mockReset();

    // Click ie9 and < ie9
    wrapper.find('LegacyBrowserFilterRow Switch').at(0).simulate('click');
    wrapper.find('LegacyBrowserFilterRow Switch').at(1).simulate('click');

    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([
      'safari_pre_6',
      'ie11',
    ]);
  });

  it('can toggle all/none for legacy browser', function () {
    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter);
    const All = wrapper.find('BulkFilterItem').at(0);
    const None = wrapper.find('BulkFilterItem').at(1);

    // Click "All" filter
    All.simulate('click');
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
      'ie10',
      'ie11',
      'safari_pre_6',
      'opera_pre_15',
      'opera_mini_pre_8',
      'android_pre_4',
    ]);

    // Click "None" filter
    None.simulate('click');
    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([]);
  });

  it('can set ip address filter', function () {
    const mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    wrapper
      .find('TextArea[name="filters:blacklisted_ips"]')
      .simulate('change', {target: {value: 'test\ntest2'}})
      .simulate('blur');
    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options['filters:blacklisted_ips']).toBe(
      'test\ntest2'
    );
  });

  it('filter by release/error message are not enabled', function () {
    expect(wrapper.find('TextArea[name="filters:releases"][disabled]')).toHaveLength(1);
    expect(
      wrapper.find('TextArea[name="filters:error_messages"][disabled]')
    ).toHaveLength(1);
  });

  it('has custom inbound filters with flag + can change', function () {
    wrapper = creator(() =>
      mountWithTheme(
        <ProjectFilters
          params={{projectId: project.slug, orgId: org.slug}}
          location={{}}
        />,
        {
          context: {
            ...TestStubs.routerContext().context,
            project: {
              ...project,
              features: ['custom-inbound-filters'],
            },
          },
          childContextTypes: TestStubs.routerContext().childContextTypes,
        }
      )
    );

    expect(wrapper.find('TextArea[name="filters:releases"]')).toHaveLength(1);
    expect(wrapper.find('TextArea[name="filters:error_messages"]')).toHaveLength(1);

    const mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    wrapper
      .find('TextArea[name="filters:releases"]')
      .simulate('change', {target: {value: 'release\nrelease2'}})
      .simulate('blur');
    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options['filters:releases']).toBe(
      'release\nrelease2'
    );

    wrapper
      .find('TextArea[name="filters:error_messages"]')
      .simulate('change', {target: {value: 'error\nerror2'}})
      .simulate('blur');
    expect(mock.mock.calls[1][1].data.options['filters:error_messages']).toBe(
      'error\nerror2'
    );
  });

  it('disables configuration for non project:write users', function () {
    wrapper = mountWithTheme(
      <ProjectFilters
        params={{projectId: project.slug, orgId: org.slug}}
        location={{}}
      />,
      TestStubs.routerContext([{organization: TestStubs.Organization({access: []})}])
    );

    expect(wrapper.find('FormField[disabled=false]')).toHaveLength(0);
    expect(wrapper.find('LegacyBrowserFilterRow[disabled=false]')).toHaveLength(0);
  });
});
