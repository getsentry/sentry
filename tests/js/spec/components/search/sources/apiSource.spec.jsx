import React from 'react';
import {mount} from 'enzyme';

import {ApiSource} from 'app/components/search/sources/apiSource';

describe('ApiSource', function() {
  let wrapper;
  let org = TestStubs.Organization();
  let orgsMock;
  let projectsMock;
  let teamsMock;
  let membersMock;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
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

  it('queries all API endpoints', function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(
      <ApiSource params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSource>,
      TestStubs.routerContext()
    );

    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();
    expect(membersMock).toHaveBeenCalled();
  });

  it('only queries org endpoint if there is no org in context', function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(
      <ApiSource params={{}} query="foo">
        {mock}
      </ApiSource>,
      TestStubs.routerContext()
    );

    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).not.toHaveBeenCalled();
    expect(teamsMock).not.toHaveBeenCalled();
    expect(membersMock).not.toHaveBeenCalled();
  });

  it('render function is called with correct results', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(
      <ApiSource params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSource>,
      TestStubs.routerContext()
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
      allResults: expect.anything(),
      results: expect.arrayContaining([
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-org',
            }),
            sourceType: 'organization',
            resultType: 'settings',
            to: '/settings/foo-org/',
          }),
          matches: expect.anything(),
          score: expect.anything(),
        }),
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-org',
            }),
            sourceType: 'organization',
            resultType: 'route',
            to: '/foo-org/',
          }),
          matches: expect.anything(),
          score: expect.anything(),
        }),
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-project',
            }),
            sourceType: 'project',
            resultType: 'settings',
            to: '/settings/org-slug/foo-project/',
          }),
          matches: expect.anything(),
          score: expect.anything(),
        }),
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-project',
            }),
            sourceType: 'project',
            resultType: 'route',
            to: '/org-slug/foo-project/',
          }),
          matches: expect.anything(),
          score: expect.anything(),
        }),
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-team',
            }),
            sourceType: 'team',
            resultType: 'settings',
            to: '/settings/org-slug/teams/foo-team/',
          }),
          matches: expect.anything(),
          score: expect.anything(),
        }),
      ]),
    });

    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(5);
  });

  it('render function is called with correct results when API requests partially succeed', async function() {
    let mock = jest.fn().mockReturnValue(null);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      statusCode: 500,
    });
    wrapper = mount(
      <ApiSource params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSource>,
      TestStubs.routerContext()
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
      allResults: expect.anything(),
      results: expect.arrayContaining([
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-org',
            }),
          }),
        }),
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-org',
            }),
          }),
        }),
        expect.objectContaining({
          item: expect.objectContaining({
            model: expect.objectContaining({
              slug: 'foo-team',
            }),
          }),
        }),
      ]),
    });

    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(3);
  });

  it('render function is updated as query changes', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(
      <ApiSource params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSource>,
      TestStubs.routerContext()
    );

    await tick();
    wrapper.update();

    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(5);
    expect(mock.mock.calls[1][0].results[0].item.model.slug).toBe('foo-org');

    mock.mockClear();
    wrapper.setProps({query: 'foo-t'});
    await tick();
    wrapper.update();

    // Still have 5 results, but is re-ordered
    expect(mock.mock.calls[0][0].results).toHaveLength(5);
    expect(mock.mock.calls[0][0].results[0].item.model.slug).toBe('foo-team');
  });

  describe('API queries', function() {
    let mock;
    beforeAll(function() {
      mock = jest.fn().mockReturnValue(null);
      wrapper = mount(
        <ApiSource params={{orgId: org.slug}} query="">
          {mock}
        </ApiSource>,
        TestStubs.routerContext()
      );
    });

    it('does not call API with empty query string', function() {
      expect(projectsMock).not.toHaveBeenCalled();
    });

    it('calls API when query string length is 1 char', function() {
      wrapper.setProps({query: 'f'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });

    it('calls API when query string length increases from 1 -> 2', function() {
      wrapper.setProps({query: 'fo'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });

    it('does not query API when query string > 2 chars', function() {
      // Should not query API when query is > 2 chars
      wrapper.setProps({query: 'foo'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(0);
    });
    it('does not query API when query string 3 -> 4 chars', function() {
      wrapper.setProps({query: 'foob'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(0);
    });

    it('re-queries API if first 2 characters are different', function() {
      wrapper.setProps({query: 'ba'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });

    it('does not requery if query string is the same', function() {
      wrapper.setProps({query: 'ba'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(0);
    });

    it('queries if we go from 2 chars -> 1 char', function() {
      wrapper.setProps({query: 'b'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });
  });
});
