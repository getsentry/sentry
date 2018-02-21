import React from 'react';

import {mount} from 'enzyme';
import ProjectFilters from 'app/views/projectFilters';

describe('ProjectFilters', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project({options: {}});
  let PROJECT_URL = `/projects/${org.slug}/${project.slug}/`;
  let wrapper;

  const getFilterEndpoint = filter => `${PROJECT_URL}filters/${filter}/`;

  const createFilterMock = filter => {
    return MockApiClient.addMockResponse({
      url: getFilterEndpoint(filter),
      method: 'PUT',
    });
  };

  const creator = custom => {
    if (custom) {
      wrapper = custom();
    } else {
      wrapper = mount(
        <ProjectFilters
          params={{projectId: project.slug, orgId: org.slug}}
          location={{}}
        />,
        TestStubs.routerContext()
      );
    }

    wrapper.instance().setState({loading: false, expected: 0});
    wrapper.update();
    return wrapper;
  };

  beforeEach(function() {
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

  it('can toggle filters: browser extensions, localhost, web crawlers', function() {
    ['browser-extensions', 'localhost', 'web-crawlers'].forEach((filter, i) => {
      let mock = createFilterMock(filter);
      const Switch = wrapper.find('FilterRow Switch').at(i);

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

      // Toggle filter off
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
  });

  it('can toggle legacy browser', function() {
    let filter = 'legacy-browsers';
    let mock = createFilterMock(filter);
    const Switch = wrapper.find('LegacyBrowserFilterRow Switch').at(0);

    // Toggle filter on
    Switch.simulate('click');
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    // Have to do this because no jest matcher for JS Set
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual(['ie_pre_9']);

    // Toggle filter off
    Switch.simulate('click');
    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([]);

    mock.mockReset();

    // Click ie9 and < ie9
    wrapper
      .find('LegacyBrowserFilterRow Switch')
      .at(0)
      .simulate('click');
    wrapper
      .find('LegacyBrowserFilterRow Switch')
      .at(1)
      .simulate('click');

    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
    ]);
  });

  it('can toggle all/none for legacy browser', function() {
    let filter = 'legacy-browsers';
    let mock = createFilterMock(filter);
    const All = wrapper.find('.filter-grid-filter a').at(0);
    const None = wrapper.find('.filter-grid-filter a').at(1);

    // Click "All" filter
    All.simulate('click');
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
      'ie10',
      'opera_pre_15',
      'safari_pre_6',
      'android_pre_4',
    ]);

    // Click "None" filter
    None.simulate('click');
    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([]);
  });

  it('can set ip address filter', function() {
    let mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    wrapper.find('#id-ip').simulate('change', {target: {value: 'test\ntest2'}});
    wrapper.find('form').simulate('submit');
    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options['filters:blacklisted_ips']).toBe(
      'test\ntest2'
    );
  });

  it('does not have filter by release/error message because no hooks store', function() {
    expect(wrapper.find('#id-release')).toHaveLength(0);
    expect(wrapper.find('#id-error')).toHaveLength(0);
  });

  it('has custom inbound filters with flag + can change', function() {
    wrapper = creator(() => {
      return mount(
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
      );
    });

    expect(wrapper.find('#id-release')).toHaveLength(1);
    expect(wrapper.find('#id-errorMessage')).toHaveLength(1);

    let mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    wrapper
      .find('#id-release')
      .simulate('change', {target: {value: 'release\nrelease2'}});
    wrapper
      .find('#id-errorMessage')
      .simulate('change', {target: {value: 'error\nerror2'}});
    wrapper.find('form').simulate('submit');
    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options['filters:error_messages']).toBe(
      'error\nerror2'
    );
    expect(mock.mock.calls[0][1].data.options['filters:releases']).toBe(
      'release\nrelease2'
    );
  });
});
