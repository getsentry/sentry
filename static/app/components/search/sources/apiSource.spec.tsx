import {ComponentProps} from 'react';
import omit from 'lodash/omit';
import {EventIdQueryResult} from 'sentry-fixture/eventIdQueryResult';
import {Members} from 'sentry-fixture/members';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {ShortIdQueryResult} from 'sentry-fixture/shortIdQueryResult';
import {Team} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {ApiSource} from 'sentry/components/search/sources/apiSource';
import ConfigStore from 'sentry/stores/configStore';

describe('ApiSource', function () {
  const {organization, router} = initializeOrg();
  let orgsMock;
  let projectsMock;
  let teamsMock;
  let membersMock;
  let shortIdMock;
  let eventIdMock;
  let configState;

  const defaultProps: ComponentProps<typeof ApiSource> = {
    query: '',
    organization,
    router,
    location: router.location,
    routes: [],
    params: {},
    children: jest.fn().mockReturnValue(null),
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [Organization({slug: 'test-org'})],
    });

    orgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [Organization({slug: 'foo-org'})],
    });
    projectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'foo-project'})],
    });
    teamsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [Team({slug: 'foo-team'})],
    });
    membersMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: Members(),
    });
    shortIdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/shortids/test-1/',
      body: ShortIdQueryResult(),
    });
    eventIdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventids/12345678901234567890123456789012/',
      body: EventIdQueryResult(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/?plugins=_all',
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
    configState = ConfigStore.getState();
  });

  afterEach(function () {
    ConfigStore.loadInitialData(configState);
  });

  it('queries all API endpoints', function () {
    const mock = jest.fn().mockReturnValue(null);
    render(
      <ApiSource {...defaultProps} query="foo">
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

  it('queries multiple regions for organization lists', function () {
    const mock = jest.fn().mockReturnValue(null);
    ConfigStore.loadInitialData({
      ...configState,
      regions: [
        {name: 'us', url: 'https://us.sentry.io'},
        {name: 'de', url: 'https://de.sentry.io'},
      ],
    });

    render(
      <ApiSource {...defaultProps} query="foo">
        {mock}
      </ApiSource>
    );

    expect(orgsMock).toHaveBeenCalledTimes(2);
    expect(orgsMock).toHaveBeenCalledWith(
      '/organizations/',
      expect.objectContaining({host: 'https://us.sentry.io'})
    );
    expect(orgsMock).toHaveBeenCalledWith(
      '/organizations/',
      expect.objectContaining({host: 'https://de.sentry.io'})
    );
  });

  it('only queries for shortids when query matches shortid format', async function () {
    const mock = jest.fn().mockReturnValue(null);
    const {rerender} = render(
      <ApiSource {...defaultProps} query="test-">
        {mock}
      </ApiSource>
    );

    expect(shortIdMock).not.toHaveBeenCalled();

    rerender(
      <ApiSource {...defaultProps} query="test-1">
        {mock}
      </ApiSource>
    );

    expect(shortIdMock).toHaveBeenCalled();

    // These may not be desired behavior in future, but lets specify the expectation regardless
    expect(orgsMock).toHaveBeenCalled();
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();
    expect(membersMock).toHaveBeenCalled();
    expect(eventIdMock).not.toHaveBeenCalled();

    await waitFor(() => {
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
  });

  it('only queries for eventids when query matches eventid format of 32 chars', async function () {
    const mock = jest.fn().mockReturnValue(null);
    const {rerender} = render(
      <ApiSource {...defaultProps} query="1234567890123456789012345678901">
        {mock}
      </ApiSource>
    );

    expect(eventIdMock).not.toHaveBeenCalled();

    rerender(
      // This is a valid short id now
      <ApiSource {...defaultProps} query="12345678901234567890123456789012">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
      expect(eventIdMock).toHaveBeenCalled();
    });

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
    render(
      <ApiSource {...omit(defaultProps, 'organization')} params={{orgId: ''}} query="foo">
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
    render(
      <ApiSource {...defaultProps} organization={organization} query="foo">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
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
              resultType: 'route',
              to: '/organizations/org-slug/alerts/rules/?project=2',
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
    });

    // The return values here are because of fuzzy search matching.
    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(6);
  });

  it('render function is called with correct results when API requests partially succeed', async function () {
    const mock = jest.fn().mockReturnValue(null);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      statusCode: 500,
    });
    render(
      <ApiSource {...defaultProps} query="foo">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
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
    });

    // The return values here are because of fuzzy search matching.
    // There are no members that match
    expect(mock.mock.calls[1][0].results).toHaveLength(3);
  });

  it('render function is updated as query changes', async function () {
    const mock = jest.fn().mockReturnValue(null);
    const {rerender} = render(
      <ApiSource {...defaultProps} query="foo">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
      // The return values here are because of fuzzy search matching.
      // There are no members that match
      expect(mock.mock.calls[1][0].results).toHaveLength(6);
      expect(mock.mock.calls[1][0].results[0].item.model.slug).toBe('foo-org');
    });

    mock.mockClear();

    rerender(
      <ApiSource {...defaultProps} query="foo-t">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
      // Still have 4 results, but is re-ordered
      expect(mock.mock.calls[0][0].results).toHaveLength(6);
      expect(mock.mock.calls[0][0].results[0].item.model.slug).toBe('foo-team');
    });
  });

  describe('API queries', function () {
    it('calls API based on query string', function () {
      const {rerender} = render(<ApiSource {...defaultProps} query="" />);

      expect(projectsMock).toHaveBeenCalledTimes(1);

      rerender(<ApiSource {...defaultProps} query="f" />);

      // calls API when query string length is 1 char
      expect(projectsMock).toHaveBeenCalledTimes(2);

      rerender(<ApiSource {...defaultProps} query="fo" />);

      // calls API when query string length increases from 1 -> 2
      expect(projectsMock).toHaveBeenCalledTimes(3);

      rerender(<ApiSource {...defaultProps} query="foo" />);

      // Should not query API when query is > 2 chars
      expect(projectsMock).toHaveBeenCalledTimes(3);

      // re-queries API if first 2 characters are different
      rerender(<ApiSource {...defaultProps} query="ba" />);

      expect(projectsMock).toHaveBeenCalledTimes(4);

      // Does not requery when query stays the same
      rerender(<ApiSource {...defaultProps} query="ba" />);

      expect(projectsMock).toHaveBeenCalledTimes(4);

      // queries if we go from 2 chars -> 1 char
      rerender(<ApiSource {...defaultProps} query="b" />);

      expect(projectsMock).toHaveBeenCalledTimes(5);
    });
  });
});
