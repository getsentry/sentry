import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SeerRepoTable} from 'sentry/components/seer/repoTable/seerRepoTable';
import type {RepositoryWithSettings} from 'sentry/types/integrations';

// jsdom has no layout, so the virtualizer would render zero rows. Force it to
// render a row per item so the table body is present.
jest.mock('@tanstack/react-virtual', () => ({
  ...jest.requireActual('@tanstack/react-virtual'),
  useVirtualizer: ({count}: {count: number}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, index) => ({
        key: index,
        index,
        start: index * 68,
        end: (index + 1) * 68,
        size: 68,
        lane: 0,
      })),
    getTotalSize: () => count * 68,
    measure: () => {},
    measureElement: () => {},
  }),
}));

function makeRepo(id: string, name: string): RepositoryWithSettings {
  return {
    ...RepositoryFixture({
      id,
      externalId: `ext-${id}`,
      name,
      provider: {id: 'integrations:github', name: 'GitHub'},
    }),
    settings: {codeReviewTriggers: ['on_ready_for_review'], enabledCodeReview: true},
  };
}

describe('SeerRepoTable', () => {
  const organization = OrganizationFixture({access: ['org:write']});

  function mockRepos(body: RepositoryWithSettings[]) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body,
    });
  }

  function getBodyRows() {
    const table = screen.getByRole('table', {name: 'Repositories'});
    const body = within(table).getAllByRole('rowgroup').at(-1)!;
    return within(body).getAllByRole('row');
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a row for each repository when repositories load', async () => {
    mockRepos([makeRepo('1', 'getsentry/sentry'), makeRepo('2', 'getsentry/relay')]);

    render(<SeerRepoTable />, {organization});

    expect(await screen.findByText('getsentry/relay')).toBeInTheDocument();
    const rows = getBodyRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('getsentry/relay')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('getsentry/sentry')).toBeInTheDocument();
  });

  it('shows the bulk actions and selection banner when a repository is selected', async () => {
    mockRepos([makeRepo('1', 'getsentry/sentry'), makeRepo('2', 'getsentry/relay')]);

    render(<SeerRepoTable />, {organization});

    await screen.findByText('getsentry/relay');
    const [firstRow] = getBodyRows();
    const [rowCheckbox] = within(firstRow!).getAllByRole('checkbox');
    await userEvent.click(rowCheckbox!);

    expect(screen.getByRole('button', {name: 'Triggers'})).toBeInTheDocument();
    expect(screen.getByText('Selected 1 repository.')).toBeInTheDocument();
    expect(screen.getByText('Select all 2 repositories.')).toBeInTheDocument();
  });

  it('shows the all-selected banner when every repository is selected', async () => {
    mockRepos([makeRepo('1', 'getsentry/sentry'), makeRepo('2', 'getsentry/relay')]);

    render(<SeerRepoTable />, {organization});

    await screen.findByText('getsentry/relay');
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Select all repositories'})
    );

    expect(screen.getByText('Selected all 2 repositories.')).toBeInTheDocument();
  });

  it('updates code review for a repository when its switch is toggled', async () => {
    mockRepos([makeRepo('1', 'getsentry/sentry')]);
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/settings/`,
      method: 'PUT',
      body: [],
    });

    render(<SeerRepoTable />, {organization});

    await screen.findByText('getsentry/sentry');
    const [row] = getBodyRows();
    const [, codeReviewSwitch] = within(row!).getAllByRole('checkbox');
    await userEvent.click(codeReviewSwitch!);

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({enabledCodeReview: false, repositoryIds: ['1']}),
        })
      )
    );
  });

  it('shows the empty state when no repositories match the search', async () => {
    mockRepos([]);

    render(<SeerRepoTable />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/seer/repos/`,
          query: {query: 'missing'},
        },
      },
    });

    const table = screen.getByRole('table', {name: 'Repositories'});
    expect(await within(table).findByText('missing')).toBeInTheDocument();
    expect(table).toHaveTextContent('No repositories found matching missing');
  });
});
