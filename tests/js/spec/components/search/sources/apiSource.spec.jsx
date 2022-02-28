import {mountWithTheme} from 'sentry-test/enzyme';

import {ApiSource} from 'sentry/components/search/sources/apiSource';

describe('ApiSource', function () {
  let wrapper;
  const org = TestStubs.Organization();
  let orgsMock;
  let projectsMock;
  let teamsMock;
  let membersMock;
  let shortIdMock;
  let eventIdMock;
  let allMocks;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/',
      query: 'test-1',
      body: [TestStubs.Organization({slug: 'test-org'})],
    });

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
    shortIdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/shortids/test-1/',
      query: 'TEST-1',
      body: TestStubs.ShortIdQueryResult(),
    });
    eventIdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventids/12345678901234567890123456789012/',
      query: '12345678901234567890123456789012',
      body: TestStubs.EventIdQueryResult(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/?plugins=_all',
      query: {plugins: '_all'},
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/configs/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/sentry-apps/?status=published',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/doc-integrations/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/shortids/foo-t/',
      body: [],
    });
    allMocks = {orgsMock, projectsMock, teamsMock, membersMock, shortIdMock, eventIdMock};
  });

  it('queries all API endpoints', function () {
    const mock = jest.fn().mockReturnValue(null);
    wrapper = mountWithTheme(
      <ApiSource params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSource>
    );

    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();
    expect(membersMock).toHaveBeenCalled();
    expect(shortIdMock).not.toHaveBeenCalled();
    expect(eventIdMock).not.toHaveBeenCalled();
  });

  it('only queries for shortids when query matches shortid format', async function () {
    const mock = jest.fn().mockReturnValue(null);
    wrapper = mountWithTheme(
      <ApiSource params={{orgId: org.slug}} query="test-">
        {mock}
      </ApiSource>
    );

    await tick();
    expect(shortIdMock).not.toHaveBeenCalled();
    // Reset all mocks
    Object.values(allMocks).forEach(m => m.mockReset);

    // This is a valid short id now
    wrapper.setProps({query: 'test-1'});
    await tick();
    wrapper.update();

    expect(shortIdMock).toHaveBeenCalled();

    // These may not be desired behavior in future, but lets specify the expectation regardless
    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();
    expect(membersMock).toHaveBeenCalled();
    expect(eventIdMock).not.toHaveBeenCalled();
    expect(mock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: [
          {
            item: expect.objectContaining({
              title: 'group type',
              description: 'group description',
              sourceType: 'issue',
              resultType: 'issue',
              to: '/org-slug/project-slug/issues/1/',
            }),
            score: 1,
            refIndex: 0,
          },
        ],
      })
    );
  });

  it('only queries for eventids when query matches eventid format of 32 chars', async function () {
    const mock = jest.fn().mockReturnValue(null);
    wrapper = mountWithTheme(
      <ApiSource params={{orgId: org.slug}} query="1234567890123456789012345678901">
        {mock}
      </ApiSource>
    );

    await tick();
    expect(eventIdMock).not.toHaveBeenCalled();
    // Reset all mocks
    Object.values(allMocks).forEach(m => m.mockReset);

    // This is a valid short id now
    wrapper.setProps({query: '12345678901234567890123456789012'});
    wrapper.update();

    await tick();

    expect(eventIdMock).toHaveBeenCalled();

    // These may not be desired behavior in future, but lets specify the expectation regardless
    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();
    expect(membersMock).toHaveBeenCalled();
    expect(shortIdMock).not.toHaveBeenCalled();
    expect(mock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: [
          {
            item: expect.objectContaining({
              title: 'event type',
              description: 'event description',
              sourceType: 'event',
              resultType: 'event',
              to: '/org-slug/project-slug/issues/1/events/12345678901234567890123456789012/',
            }),
            score: 1,
            refIndex: 0,
          },
        ],
      })
    );
  });

  it('only queries org endpoint if there is no org in context', function () {
    const mock = jest.fn().mockReturnValue(null);
    wrapper = mountWithTheme(
      <ApiSource params={{}} query="foo">
        {mock}
      </ApiSource>
    );

    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).not.toHaveBeenCalled();
    expect(teamsMock).not.toHaveBeenCalled();
    expect(membersMock).not.toHaveBeenCalled();
  });

  it('render function is called with correct results', async function () {
    const mock = jest.fn().mockReturnValue(null);
    wrapper = mountWithTheme(
      <ApiSource params={{orgId: org.slug}} organization={org} query="foo">
        {mock}
      </ApiSource>
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
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
            resultType: 'route',
            to: '/organizations/org-slug/projects/foo-project/?project=2',
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
            to: '/settings/org-slug/projects/foo-project/',
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

    // The return values here are because of fuzzy search matching.
    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(5);
  });

  it('render function is called with correct results when API requests partially succeed', async function () {
    const mock = jest.fn().mockReturnValue(null);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      statusCode: 500,
    });
    wrapper = mountWithTheme(
      <ApiSource params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSource>
    );

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenLastCalledWith({
      isLoading: false,
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

    // The return values here are because of fuzzy search matching.
    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(3);
  });

  it('render function is updated as query changes', async function () {
    const mock = jest.fn().mockReturnValue(null);
    wrapper = mountWithTheme(
      <ApiSource params={{orgId: org.slug}} query="foo">
        {mock}
      </ApiSource>
    );

    await tick();
    wrapper.update();

    // The return values here are because of fuzzy search matching.
    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(5);
    expect(mock.mock.calls[1][0].results[0].item.model.slug).toBe('foo-org');

    mock.mockClear();
    wrapper.setProps({query: 'foo-t'});
    await tick();
    wrapper.update();

    // Still have 4 results, but is re-ordered
    expect(mock.mock.calls[0][0].results).toHaveLength(5);
    expect(mock.mock.calls[0][0].results[0].item.model.slug).toBe('foo-team');
  });

  describe('API queries', function () {
    let mock;
    beforeAll(function () {
      mock = jest.fn().mockReturnValue(null);
      wrapper = mountWithTheme(
        <ApiSource params={{orgId: org.slug}} query="">
          {mock}
        </ApiSource>
      );
    });

    it('does not call API with empty query string', function () {
      expect(projectsMock).not.toHaveBeenCalled();
    });

    it('calls API when query string length is 1 char', function () {
      wrapper.setProps({query: 'f'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });

    it('calls API when query string length increases from 1 -> 2', function () {
      wrapper.setProps({query: 'fo'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });

    it('does not query API when query string > 2 chars', function () {
      // Should not query API when query is > 2 chars
      wrapper.setProps({query: 'foo'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(0);
    });
    it('does not query API when query string 3 -> 4 chars', function () {
      wrapper.setProps({query: 'foob'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(0);
    });

    it('re-queries API if first 2 characters are different', function () {
      wrapper.setProps({query: 'ba'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });

    it('does not requery if query string is the same', function () {
      wrapper.setProps({query: 'ba'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(0);
    });

    it('queries if we go from 2 chars -> 1 char', function () {
      wrapper.setProps({query: 'b'});
      wrapper.update();
      expect(projectsMock).toHaveBeenCalledTimes(1);
    });
  });
});
