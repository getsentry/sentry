import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import IssueViewsList from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsList';

const organization = OrganizationFixture({
  features: ['issue-view-sharing'],
});

describe('IssueViewsList', function () {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      match: [MockApiClient.matchQuery({createdBy: 'me'})],
      body: [
        GroupSearchViewFixture({
          id: '1',
          name: 'Foo',
          projects: [1],
          environments: ['env1'],
          query: 'foo:bar',
          timeFilters: {
            period: '7d',
            start: null,
            end: null,
            utc: null,
          },
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      match: [MockApiClient.matchQuery({createdBy: 'others'})],
      body: [
        GroupSearchViewFixture({
          id: '2',
          name: 'Bar',
          projects: [],
          environments: [],
          query: 'bar:baz',
          timeFilters: {
            period: '1d',
            start: null,
            end: null,
            utc: null,
          },
        }),
      ],
    });
  });

  it('displays views from myself and others', async function () {
    render(<IssueViewsList />, {organization});

    expect(await screen.findByText('Foo')).toBeInTheDocument();
    expect(screen.getByText('Foo')).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/views/1/`
    );
    expect(screen.getByText(textWithMarkupMatcher('foo is bar'))).toBeInTheDocument();
    expect(screen.getByText('env1')).toBeInTheDocument();

    expect(await screen.findByText('Bar')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/views/2/`
    );
    expect(screen.getByText(textWithMarkupMatcher('bar is baz'))).toBeInTheDocument();
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });
});
