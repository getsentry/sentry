import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import {IsFieldValues} from 'sentry/utils/fields';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

describe('IssueListSearchBar (old)', function () {
  let recentSearchMock;
  let defaultProps;

  const {router, organization} = initializeOrg();

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TagsFixture());

    defaultProps = {
      organization,
      query: '',
      onSearch: jest.fn(),
    };

    recentSearchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('updateAutoCompleteItems()', function () {
    it('sets state with complete tag', async function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {
        router,
      });

      await userEvent.click(screen.getByRole('textbox'));
      await userEvent.paste('url:"fu"');

      waitFor(() =>
        expect(tagValuesMock).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'fu',
            }),
          })
        )
      );

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
    });

    it('sets state when value has colon', async function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {
        router,
      });

      await userEvent.click(screen.getByRole('textbox'));
      await userEvent.paste('url:', {delay: null});
      waitFor(() => expect(tagValuesMock).toHaveBeenCalled());
    });

    it('does not request values when tag is `timesSeen`', async function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {
        router,
      });

      await userEvent.click(screen.getByRole('textbox'));
      await userEvent.paste('timesSeen:', {delay: null});

      waitFor(() => expect(tagValuesMock).not.toHaveBeenCalled());
    });
  });

  describe('Recent Searches', function () {
    it('saves search query as a recent search', async function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });
      const saveRecentSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'POST',
        body: {},
      });
      const onSearch = jest.fn();

      render(<IssueListSearchBar {...defaultProps} onSearch={onSearch} />, {
        router,
      });

      await userEvent.click(screen.getByRole('textbox'));
      await userEvent.paste('url:"fu"');

      waitFor(() =>
        expect(tagValuesMock).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'fu',
            }),
          })
        )
      );

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();

      await userEvent.keyboard('{Enter}');

      expect(onSearch).toHaveBeenCalledWith('url:"fu"');

      waitFor(() => {
        expect(saveRecentSearch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              query: 'url:"fu"',
              type: 0,
            },
          })
        );
      });
    });

    it('queries for recent searches', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {router});

      await userEvent.click(screen.getByRole('textbox'));
      await userEvent.paste('is:', {delay: null});
      waitFor(() =>
        expect(recentSearchMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              query: 'is:',
              limit: 3,
              type: 0,
            },
          })
        )
      );
    });
  });
});

describe('IssueListSearchBar (new)', function () {
  let defaultProps;

  const {router, organization} = initializeOrg();

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TagsFixture());

    organization.features = ['issue-stream-search-query-builder'];
    defaultProps = {
      organization,
      query: '',
      onSearch: jest.fn(),
    };
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('displays the correct options for the is tag', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });

    render(<IssueListSearchBar {...defaultProps} />, {
      router: router,
    });

    await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
    await userEvent.paste('is:', {delay: null});
    await userEvent.click(
      await screen.findByRole('button', {name: 'Edit value for filter: is'})
    );

    Object.values(IsFieldValues).forEach(value => {
      expect(screen.getByRole('option', {name: value})).toBeInTheDocument();
    });
  });

  it('displays the correct options under Event Tags', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{key: 'someTag', name: 'Some Tag'}],
    });

    defaultProps.organization.features = ['issue-stream-search-query-builder'];

    render(<IssueListSearchBar {...defaultProps} />, {
      router: router,
    });

    await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
    await userEvent.click(screen.getByRole('button', {name: 'Event Tags'}));

    expect(await screen.findByRole('option', {name: 'someTag'})).toBeInTheDocument();
  });

  it('displays tags in the has filter', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{key: 'someTag', name: 'Some Tag'}],
    });

    defaultProps.organization.features = ['issue-stream-search-query-builder'];

    render(<IssueListSearchBar {...defaultProps} />, {
      router: router,
    });

    await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
    await userEvent.paste('has:', {delay: null});
    await userEvent.click(
      await screen.findByRole('button', {name: 'Edit value for filter: has'})
    );

    expect(await screen.findByRole('option', {name: 'someTag'})).toBeInTheDocument();
  });
});
