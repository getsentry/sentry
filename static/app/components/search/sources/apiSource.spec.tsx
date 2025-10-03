import type {ComponentProps} from 'react';
import {EventFixture} from 'sentry-fixture/event';
import {EventIdQueryResultFixture} from 'sentry-fixture/eventIdQueryResult';
import {MembersFixture} from 'sentry-fixture/members';
import {ProjectFixture} from 'sentry-fixture/project';
import {ShortIdQueryResultFixture} from 'sentry-fixture/shortIdQueryResult';
import {TeamFixture} from 'sentry-fixture/team';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ApiSource from 'sentry/components/search/sources/apiSource';
import ConfigStore from 'sentry/stores/configStore';

import type {Result} from './types';

describe('ApiSource', () => {
  let projectsMock: jest.Mock;
  let teamsMock: jest.Mock;
  let membersMock: jest.Mock;
  let shortIdMock: jest.Mock;
  let eventIdMock: jest.Mock;
  let configState: ReturnType<typeof ConfigStore.getState>;

  const defaultProps: ComponentProps<typeof ApiSource> = {
    query: '',
    debounceDuration: 0,
    children: jest.fn().mockReturnValue(null),
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    projectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'foo-project'})],
    });
    teamsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TeamFixture({slug: 'foo-team'})],
    });
    membersMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: MembersFixture(),
    });
    shortIdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/shortids/JAVASCRIPT-6QS/',
      body: ShortIdQueryResultFixture(),
    });
    eventIdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventids/12345678901234567890123456789012/',
      body: EventIdQueryResultFixture({
        event: EventFixture({id: '12345678901234567890123456789012'}),
      }),
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

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  it('queries all API endpoints', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(
      <ApiSource {...defaultProps} query="foo">
        {mock}
      </ApiSource>
    );

    await waitFor(() => expect(projectsMock).toHaveBeenCalled());
    expect(teamsMock).toHaveBeenCalled();
    expect(membersMock).toHaveBeenCalled();
    expect(shortIdMock).not.toHaveBeenCalled();
    expect(eventIdMock).not.toHaveBeenCalled();
  });

  it('only queries for shortids when query matches shortid format', async () => {
    const mock = jest.fn().mockReturnValue(null);
    const {rerender} = render(
      <ApiSource {...defaultProps} query="JAVASCRIPT">
        {mock}
      </ApiSource>
    );

    expect(shortIdMock).not.toHaveBeenCalled();

    rerender(
      <ApiSource {...defaultProps} query="JAVASCRIPT-6QS">
        {mock}
      </ApiSource>
    );

    expect(shortIdMock).toHaveBeenCalled();

    await waitFor(() =>
      expect(mock.mock.calls[5][0].results.map((result: Result) => result.item)).toEqual([
        expect.objectContaining({
          title: 'group type',
          description: 'group description',
          sourceType: 'issue',
          resultType: 'issue',
          to: '/org-slug/project-slug/issues/1/',
        }),
      ])
    );
  });

  it('only queries for eventids when query matches eventid format of 32 chars', async () => {
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

    await waitFor(() =>
      expect(mock.mock.calls[5][0].results.map((result: Result) => result.item)).toEqual([
        expect.objectContaining({
          title: 'Event',
          description: undefined,
          sourceType: 'event',
          resultType: 'event',
          to: '/org-slug/project-slug/issues/1/events/12345678901234567890123456789012/',
        }),
      ])
    );
  });

  it('Does not query org apis when no org in context', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(
      <ApiSource {...defaultProps} query="foo">
        {mock}
      </ApiSource>,
      {organization: null}
    );

    await waitFor(() => !mock.mock.calls[2][0].isLoading);
    expect(projectsMock).not.toHaveBeenCalled();
    expect(teamsMock).not.toHaveBeenCalled();
    expect(membersMock).not.toHaveBeenCalled();
  });

  it('render function is called with correct results', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(
      <ApiSource {...defaultProps} query="foo">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
      const results = mock.mock.calls[2][0].results.map((result: Result) => result.item);

      expect(results).toEqual([
        expect.objectContaining({
          model: expect.objectContaining({slug: 'foo-project'}),
          sourceType: 'project',
          resultType: 'route',
          to: '/organizations/org-slug/insights/projects/foo-project/?project=2',
        }),
        expect.objectContaining({
          model: expect.objectContaining({slug: 'foo-project'}),
          sourceType: 'project',
          resultType: 'settings',
          to: '/settings/org-slug/projects/foo-project/',
        }),
        expect.objectContaining({
          model: expect.objectContaining({slug: 'foo-project'}),
          sourceType: 'project',
          resultType: 'route',
          to: '/organizations/org-slug/issues/alerts/rules/?project=2',
        }),
        expect.objectContaining({
          model: expect.objectContaining({slug: 'foo-team'}),
          sourceType: 'team',
          resultType: 'settings',
          to: '/settings/org-slug/teams/foo-team/',
        }),
      ]);
    });
  });

  it('render function is called with correct results when API requests partially succeed', async () => {
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
      const titles = mock.mock.calls[2][0].results.map(
        (result: Result) => result.item.title
      );
      expect(titles).toEqual(['#foo-team']);
    });
  });

  it('render function is updated as query changes', async () => {
    const mock = jest.fn().mockReturnValue(null);
    const {rerender} = render(
      <ApiSource {...defaultProps} query="foo">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
      // The return values here are because of fuzzy search matching.
      // There are no members that match
      expect(mock.mock.calls[2][0].results).toHaveLength(4);
    });

    expect(mock.mock.calls[2][0].results[0].item.model.slug).toBe('foo-project');

    mock.mockClear();

    rerender(
      <ApiSource {...defaultProps} query="foo-t">
        {mock}
      </ApiSource>
    );

    await waitFor(() => {
      // Still have 4 results, but is re-ordered
      expect(mock.mock.calls[0][0].results).toHaveLength(4);
    });
    expect(mock.mock.calls[0][0].results[0].item.model.slug).toBe('foo-project');
  });

  describe('API queries', () => {
    it('calls API based on query string', async () => {
      const {rerender} = render(<ApiSource {...defaultProps} query="" />);

      await waitFor(() => {
        expect(projectsMock).toHaveBeenCalledTimes(1);
      });

      rerender(<ApiSource {...defaultProps} query="f" />);

      // calls API when query string length is 1 char
      await waitFor(() => {
        expect(projectsMock).toHaveBeenCalledTimes(2);
      });

      rerender(<ApiSource {...defaultProps} query="fo" />);

      // calls API when query string length increases from 1 -> 2
      await waitFor(() => {
        expect(projectsMock).toHaveBeenCalledTimes(3);
      });

      rerender(<ApiSource {...defaultProps} query="foo" />);

      // Should not query API when query is > 2 chars
      await waitFor(() => {
        expect(projectsMock).toHaveBeenCalledTimes(3);
      });

      // re-queries API if first 2 characters are different
      rerender(<ApiSource {...defaultProps} query="ba" />);

      await waitFor(() => {
        expect(projectsMock).toHaveBeenCalledTimes(4);
      });

      // Does not requery when query stays the same
      rerender(<ApiSource {...defaultProps} query="ba" />);

      await waitFor(() => {
        expect(projectsMock).toHaveBeenCalledTimes(4);
      });

      // queries if we go from 2 chars -> 1 char
      rerender(<ApiSource {...defaultProps} query="b" />);

      await waitFor(() => {
        expect(projectsMock).toHaveBeenCalledTimes(5);
      });
    });
  });
});
