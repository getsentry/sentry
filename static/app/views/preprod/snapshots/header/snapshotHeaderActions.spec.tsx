import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotHeaderActions} from './snapshotHeaderActions';

jest.mock('sentry/utils/downloadFromHref');

const ORG_SLUG = 'org-slug';
const ARTIFACT_ID = '123';
const API_URL = `/organizations/${ORG_SLUG}/preprodartifacts/snapshots/${ARTIFACT_ID}/`;
const ARCHIVE_URL = `/organizations/${ORG_SLUG}/preprodartifacts/snapshots/${ARTIFACT_ID}/archive/`;

const data = {
  head_artifact_id: ARTIFACT_ID,
  project_id: '456',
  comparison_type: 'solo',
  comparison_state: 'success',
  approval_status: 'approved',
  approvers: [],
  base_artifact_id: null,
  image_count: 0,
  images: [],
  state: 'processed',
  vcs_info: {},
  added: [],
  added_count: 0,
  changed: [],
  changed_count: 0,
  removed: [],
  removed_count: 0,
  unchanged: [],
  unchanged_count: 0,
} as unknown as SnapshotDetailsApiResponse;

function renderActions() {
  const organization = OrganizationFixture({slug: ORG_SLUG});
  return render(
    <SnapshotHeaderActions data={data} organizationSlug={ORG_SLUG} apiUrl={API_URL} />,
    {organization}
  );
}

async function clickDownloadImages() {
  await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
  await userEvent.click(await screen.findByText('Download Images'));
}

describe('SnapshotHeaderActions download images', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('downloads directly when the archive is already built', async () => {
    const probeMock = MockApiClient.addMockResponse({
      url: ARCHIVE_URL,
      method: 'GET',
      body: {ready: true},
    });
    const buildMock = MockApiClient.addMockResponse({
      url: ARCHIVE_URL,
      method: 'POST',
      statusCode: 202,
      body: {detail: 'building'},
    });

    renderActions();
    renderGlobalModal();
    await clickDownloadImages();

    await waitFor(() => expect(probeMock).toHaveBeenCalled());
    await waitFor(() => expect(downloadFromHref).toHaveBeenCalledTimes(1));
    expect(buildMock).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Export all snapshots to a zip file/)
    ).not.toBeInTheDocument();
  });

  it('confirms then triggers a build when the archive is not ready', async () => {
    MockApiClient.addMockResponse({
      url: ARCHIVE_URL,
      method: 'GET',
      body: {ready: false},
    });
    const buildMock = MockApiClient.addMockResponse({
      url: ARCHIVE_URL,
      method: 'POST',
      statusCode: 202,
      body: {detail: 'building'},
    });

    renderActions();
    renderGlobalModal();
    await clickDownloadImages();

    expect(
      await screen.findByText(/Export all snapshots to a zip file/)
    ).toBeInTheDocument();
    expect(buildMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(buildMock).toHaveBeenCalledTimes(1));
    expect(downloadFromHref).not.toHaveBeenCalled();
  });

  it('does not build when the confirm modal is cancelled', async () => {
    MockApiClient.addMockResponse({
      url: ARCHIVE_URL,
      method: 'GET',
      body: {ready: false},
    });
    const buildMock = MockApiClient.addMockResponse({
      url: ARCHIVE_URL,
      method: 'POST',
      statusCode: 202,
      body: {detail: 'building'},
    });

    renderActions();
    renderGlobalModal();
    await clickDownloadImages();

    await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    expect(buildMock).not.toHaveBeenCalled();
    expect(downloadFromHref).not.toHaveBeenCalled();
  });
});
