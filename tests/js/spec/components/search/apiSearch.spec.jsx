import React from 'react';
import {mount} from 'enzyme';

import {ApiSearch} from 'app/components/search/apiSearch';

jest.mock('lodash/debounce', () => jest.fn(fn => fn));

describe('ApiSearch', function() {
  let wrapper;
  let org = TestStubs.Organization();
  let orgsMock;
  let projectsMock;
  let teamsMock;
  let membersMock;

  beforeEach(function() {
    orgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      query: 'foo',
      body: [TestStubs.Organization({slug: 'foo-org'})],
    });
    projectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });
    teamsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      query: 'foo',
      body: [TestStubs.Team({slug: 'foo-team'})],
    });
    membersMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      query: 'foo',
      body: TestStubs.Members(),
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('queries all API endpoints', function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(
      <ApiSearch params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSearch>,
      TestStubs.routerContext()
    );

    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();
    expect(membersMock).toHaveBeenCalled();
  });

  it('render function is called with correct results', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(
      <ApiSearch params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSearch>,
      TestStubs.routerContext()
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
      allResults: expect.anything(),
      results: expect.arrayContaining([
        expect.objectContaining({
          searchIndex: 'foo-org',
          model: expect.objectContaining({
            slug: 'foo-org',
          }),
          sourceType: 'organization',
          resultType: 'settings',
          to: '/settings/foo-org/',
        }),
        expect.objectContaining({
          searchIndex: 'foo-org Dashboard',
          model: expect.objectContaining({
            slug: 'foo-org',
          }),
          sourceType: 'organization',
          resultType: 'route',
          to: '/foo-org/',
        }),
        expect.objectContaining({
          searchIndex: 'foo-project',
          model: expect.objectContaining({
            slug: 'foo-project',
          }),
          sourceType: 'project',
          resultType: 'settings',
          to: '/settings/org-slug/foo-project/',
        }),
        expect.objectContaining({
          searchIndex: 'foo-project Dashboard',
          model: expect.objectContaining({
            slug: 'foo-project',
          }),
          sourceType: 'project',
          resultType: 'route',
          to: '/org-slug/foo-project/',
        }),
        expect.objectContaining({
          searchIndex: 'foo-team',
          model: expect.objectContaining({
            slug: 'foo-team',
          }),
          sourceType: 'team',
          resultType: 'settings',
          to: '/settings/org-slug/teams/foo-team/',
        }),
      ]),
    });

    // There are no members that match
    expect(mock.mock.calls[1][0].results.length).toBe(5);
  });

  it('render function is called with correct results when API requests partially succeed', async function() {
    let mock = jest.fn().mockReturnValue(null);

    teamsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      statusCode: 500,
    });
    wrapper = mount(
      <ApiSearch params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSearch>,
      TestStubs.routerContext()
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
      allResults: expect.anything(),
      results: expect.arrayContaining([
        expect.objectContaining({
          model: expect.objectContaining({
            slug: 'foo-org',
          }),
        }),
        expect.objectContaining({
          model: expect.objectContaining({
            slug: 'foo-org',
          }),
        }),
        expect.objectContaining({
          model: expect.objectContaining({
            slug: 'foo-team',
          }),
        }),
      ]),
    });

    // There are no members that match
    expect(mock.mock.calls[1][0].results.length).toBe(3);
  });

  it('render function is updated as query changes', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(
      <ApiSearch params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSearch>,
      TestStubs.routerContext()
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
      allResults: expect.anything(),
      results: expect.arrayContaining([
        expect.objectContaining({
          model: expect.objectContaining({
            slug: 'foo-org',
          }),
        }),
        expect.objectContaining({
          model: expect.objectContaining({
            slug: 'foo-project',
          }),
        }),
        expect.objectContaining({
          model: expect.objectContaining({
            slug: 'foo-team',
          }),
        }),
      ]),
    });

    // There are no members that match
    expect(mock.mock.calls[1][0].results.length).toBe(5);

    mock.mockClear();
    wrapper.setProps({query: 'foo-t'});
    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
      allResults: expect.anything(),
      results: [
        expect.objectContaining({
          model: expect.objectContaining({
            slug: 'foo-team',
          }),
        }),
      ],
    });

    // Should have two calls, first call is setLoading
    expect(mock.mock.calls[1][0].results.length).toBe(1);
  });
});
