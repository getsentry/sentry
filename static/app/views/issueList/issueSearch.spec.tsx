import {Fragment} from 'react';
import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {IssueSearch} from 'sentry/views/issueList/issueSearch';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const organization = OrganizationFixture({features: ['issue-views']});

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'clientWidth', {
    value: 400,
    configurable: true,
  });
  MockApiClient.addMockResponse({url: '/organizations/org-slug/tags/', body: []});
  MockApiClient.addMockResponse({url: '/organizations/org-slug/members/', body: []});
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/recent-searches/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/recent-searches/',
    method: 'POST',
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issue-view-title/generate/',
    method: 'POST',
    body: {},
  });
});

afterEach(() => {
  Object.defineProperty(Element.prototype, 'clientWidth', {
    value: 1000,
    configurable: true,
  });
});

it('saves the current editor query without requiring Enter', async () => {
  const onSearch = jest.fn();
  const createView = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/group-search-views/',
    method: 'POST',
    body: GroupSearchViewFixture({id: '100'}),
  });
  render(
    <Fragment>
      <IssueSearch query="" sort={IssueSortOptions.DATE} onSearch={onSearch} />
      <GlobalModal />
    </Fragment>,
    {organization}
  );

  const editor = screen.getByTestId('search-query-builder');
  await userEvent.click(
    within(editor).getByRole('combobox', {name: 'Add a search term'})
  );
  await userEvent.keyboard('hello{Escape}');
  await userEvent.click(within(editor).getByRole('button', {name: 'Save as'}));
  expect(onSearch).toHaveBeenCalledWith('hello', expect.anything());
  const modal = screen.getByRole('dialog');
  await userEvent.type(within(modal).getByRole('textbox', {name: 'Name'}), 'My view');
  await userEvent.click(within(modal).getByRole('button', {name: 'Create View'}));
  await waitFor(() =>
    expect(createView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: expect.objectContaining({query: 'hello'})})
    )
  );
});

it('clears unsubmitted edits back to the applied feed query', async () => {
  const onSearch = jest.fn();
  render(<IssueSearch query="" sort={IssueSortOptions.DATE} onSearch={onSearch} />, {
    organization,
  });
  expect(screen.getByRole('button', {name: 'Clear'})).toBeDisabled();
  await userEvent.click(
    screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)!
  );
  await userEvent.paste('is:unresolved');
  await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
  expect(onSearch).toHaveBeenCalledWith('', expect.anything());
  expect(
    screen.queryByRole('button', {name: 'Edit value for filter: is'})
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Clear'})).toBeDisabled();
});

it('restores all saved view filters and clears the local editor draft', async () => {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/group-search-views/100/',
    body: GroupSearchViewFixture({
      id: '100',
      query: 'is:unresolved',
      environments: ['prod'],
    }),
  });
  const {router} = render(
    <IssueSearch query="is:resolved" sort={IssueSortOptions.DATE} onSearch={jest.fn()} />,
    {
      organization,
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/views/:viewId/',
        location: {
          pathname: '/organizations/org-slug/issues/views/100/',
          query: {query: 'is:resolved', environment: ['dev']},
        },
      },
    }
  );
  await screen.findByRole('button', {name: 'Save'});
  await userEvent.click(
    screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)!
  );
  await userEvent.paste(' level:error');
  await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
  await waitFor(() =>
    expect(router.location.query).toEqual(
      expect.objectContaining({query: 'is:unresolved', environment: 'prod'})
    )
  );
  expect(
    screen.getByRole('button', {name: 'Edit value for filter: is'})
  ).toHaveTextContent('unresolved');
  expect(
    screen.queryByRole('button', {name: 'Edit value for filter: level'})
  ).not.toBeInTheDocument();
});

it('updates an existing view with the unsubmitted editor query', async () => {
  const view = GroupSearchViewFixture({id: '100', query: 'is:unresolved'});
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/group-search-views/100/',
    body: view,
  });
  const updateView = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/group-search-views/100/',
    method: 'PUT',
    body: view,
  });
  const onSearch = jest.fn();
  render(
    <IssueSearch
      query="is:unresolved"
      sort={IssueSortOptions.DATE}
      onSearch={onSearch}
    />,
    {
      organization,
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/views/:viewId/',
        location: {
          pathname: '/organizations/org-slug/issues/views/100/',
          query: {query: 'is:unresolved'},
        },
      },
    }
  );
  await screen.findByRole('button', {name: 'Save'});
  await userEvent.click(
    screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)!
  );
  await userEvent.keyboard('hello{Escape}');
  await userEvent.click(screen.getByRole('button', {name: 'Save'}));
  expect(onSearch).toHaveBeenCalledWith('is:unresolved hello', expect.anything());
  await waitFor(() =>
    expect(updateView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({query: 'is:unresolved hello'}),
      })
    )
  );
});
