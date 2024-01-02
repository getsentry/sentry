import {Organization} from 'sentry-fixture/organization';
import {Release as ReleaseFixture} from 'sentry-fixture/release';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {ReleaseStatus} from 'sentry/types';
import {QueryClientProvider} from 'sentry/utils/queryClient';

import ReleaseContext from './releaseContext';
import {defaultRow, mockedCommit, mockedUser1, mockedUser2} from './testUtils';

export const mockedReleaseWithHealth = ReleaseFixture({
  id: '1',
  shortVersion: 'sentry-android-shop@1.2.0',
  version: 'sentry-android-shop@1.2.0',
  dateCreated: '2010-05-17T02:41:20Z',
  lastEvent: '2011-10-17T02:41:20Z',
  firstEvent: '2010-05-17T02:41:20Z',
  status: ReleaseStatus.ACTIVE,
  commitCount: 4,
  lastCommit: mockedCommit,
  newGroups: 21,
  authors: [mockedUser1, mockedUser2],
});

const renderReleaseContext = () => {
  const organization = Organization();
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <ReleaseContext dataRow={defaultRow} organization={organization} />
    </QueryClientProvider>,
    {organization}
  );
};

describe('Quick Context Content Release Column', function () {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(
        'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76'
      )}/`,
      body: mockedReleaseWithHealth,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('Renders Release details for release', async () => {
    renderReleaseContext();

    expect(await screen.findByText(/Created/i)).toBeInTheDocument();
    expect(screen.getByText(/7 years ago/i)).toBeInTheDocument();
    expect(screen.getByText(/Last Event/i)).toBeInTheDocument();
    expect(screen.getByText(/6 years ago/i)).toBeInTheDocument();
    expect(screen.getByText(/New Issues/i)).toBeInTheDocument();
    expect(screen.getByText(/21/i)).toBeInTheDocument();
  });

  it('Renders Last Commit', async () => {
    renderReleaseContext();

    expect(await screen.findByText(/Last Commit/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-context-commit-row')).toBeInTheDocument();
  });

  it('Renders Commit Count and Author when user is NOT in list of authors', async () => {
    renderReleaseContext();

    const authorsSectionHeader = within(
      await screen.findByTestId('quick-context-release-author-header')
    );

    expect(authorsSectionHeader.getByText(/4/i)).toBeInTheDocument();
    expect(authorsSectionHeader.getByText(/commits by/i)).toBeInTheDocument();
    expect(authorsSectionHeader.getByText(/2/i)).toBeInTheDocument();
    expect(authorsSectionHeader.getByText(/authors/i)).toBeInTheDocument();
    expect(screen.getByText(/KN/i)).toBeInTheDocument();
    expect(screen.getByText(/VN/i)).toBeInTheDocument();
  });

  it('Renders Commit Count and Author when user is in list of authors', async () => {
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => mockedUser1);
    renderReleaseContext();

    expect(await screen.findByText(/4/i)).toBeInTheDocument();
    expect(screen.getByText(/commits by you and 1 other/i)).toBeInTheDocument();
    expect(screen.getByText(/KN/i)).toBeInTheDocument();
    expect(screen.getByText(/VN/i)).toBeInTheDocument();
  });
});
