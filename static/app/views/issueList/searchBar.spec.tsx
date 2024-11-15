import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import type {Tag, TagValue} from 'sentry/types/group';
import {IsFieldValues} from 'sentry/utils/fields';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

describe('IssueListSearchBar', function () {
  const {organization} = initializeOrg();

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TagsFixture());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('Tags and Fields', function () {
    const defaultProps = {
      organization,
      query: '',
      statsPeriod: '7d',
      onSearch: jest.fn(),
    };

    it('displays the correct options for the is tag', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />);

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

      render(<IssueListSearchBar {...defaultProps} />);

      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(await screen.findByRole('button', {name: 'Event Tags'}));

      expect(await screen.findByRole('option', {name: 'someTag'})).toBeInTheDocument();
    });

    it('displays tags in the has filter', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [{key: 'someTag', name: 'Some Tag'}],
      });

      render(<IssueListSearchBar {...defaultProps} />);

      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.paste('has:', {delay: null});
      await userEvent.click(
        await screen.findByRole('button', {name: 'Edit value for filter: has'})
      );

      expect(await screen.findByRole('option', {name: 'someTag'})).toBeInTheDocument();
    });

    it('displays conflicting tags', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [{key: 'message', name: 'message'}],
      });

      render(<IssueListSearchBar {...defaultProps} />);

      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));

      // Should display `message` and `tags[message]` as separate options
      expect(await screen.findByRole('option', {name: 'message'})).toBeInTheDocument();
      expect(
        await screen.findByRole('option', {name: 'tags[message]'})
      ).toBeInTheDocument();
    });
  });

  describe('Tag Values', function () {
    const newDefaultProps = {
      organization,
      query: '',
      statsPeriod: '7d',
      onSearch: jest.fn(),
    };

    it('displays the correct tag values for a key', async () => {
      const tagKey = 'random';
      const tagValue = 'randomValue';
      const tagValueResponse: TagValue[] = [
        {
          name: tagValue,
          value: tagValue,
          count: 1,
          firstSeen: '2021-01-01T00:00:00Z',
          lastSeen: '2021-01-01T00:00:00Z',
          email: 'a@sentry.io',
          username: 'a',
          id: '1',
          ip_address: '1',
        },
      ];
      const tag: Tag = {
        key: tagKey,
        name: tagKey,
      };

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        method: 'GET',
        body: [tag],
      });
      const tagValueMock = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/tags/${tagKey}/values/`,
        method: 'GET',
        body: tagValueResponse,
      });

      render(<IssueListSearchBar {...newDefaultProps} />);

      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.paste(tagKey, {delay: null});
      await userEvent.click(screen.getByRole('option', {name: tagKey}));
      expect(await screen.findByRole('option', {name: tagValue})).toBeInTheDocument();

      await waitFor(() => {
        // Expected twice since we make one request for values in events dataset
        // and another for values in IssuePlatform dataset.
        expect(tagValueMock).toHaveBeenCalledTimes(2);
      });
    });
  });
});
