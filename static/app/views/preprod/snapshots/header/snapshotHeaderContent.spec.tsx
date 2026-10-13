import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotHeaderContent} from './snapshotHeaderContent';

jest.mock('sentry/utils/downloadFromHref');

const ORG_SLUG = 'org-slug';
const ARTIFACT_ID = '123';
const API_URL = getApiUrl(
  '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/',
  {path: {organizationIdOrSlug: ORG_SLUG, snapshotId: ARTIFACT_ID}}
);
const ARCHIVE_URL = `/organizations/${ORG_SLUG}/preprodartifacts/snapshots/${ARTIFACT_ID}/archive/`;
const APPROVE_URL = `/organizations/${ORG_SLUG}/preprodartifacts/${ARTIFACT_ID}/approve/`;

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

function renderActions(overrides: Partial<SnapshotDetailsApiResponse> = {}) {
  const organization = OrganizationFixture({slug: ORG_SLUG});
  return render(
    <SnapshotHeaderContent
      snapshotId={ARTIFACT_ID}
      data={{...data, ...overrides}}
      organizationSlug={ORG_SLUG}
      apiUrl={API_URL}
    />,
    {organization}
  );
}

async function clickDownloadImages() {
  await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
  await userEvent.click(await screen.findByText('Download Images'));
}

describe('SnapshotHeaderContent download images', () => {
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

describe('SnapshotHeaderContent re-approve', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('re-approves from the overflow menu when already approved', async () => {
    const approveMock = MockApiClient.addMockResponse({
      url: APPROVE_URL,
      method: 'POST',
      match: [MockApiClient.matchData({feature_type: 'snapshots'})],
      statusCode: 200,
      body: {detail: 'Already approved'},
    });

    renderActions({comparison_state: 'success', approval_status: 'approved'});
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    await userEvent.click(await screen.findByText('Re-approve'));

    await waitFor(() => expect(approveMock).toHaveBeenCalledTimes(1));
  });

  it('does not offer re-approve for auto-approved builds', async () => {
    renderActions({comparison_state: 'success', approval_status: 'auto_approved'});
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));

    expect(await screen.findByText('Rerun Status Checks')).toBeInTheDocument();
    expect(screen.queryByText('Re-approve')).not.toBeInTheDocument();
  });

  it('does not offer re-approve while approval is still required', async () => {
    renderActions({comparison_state: 'success', approval_status: 'requires_approval'});
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));

    expect(await screen.findByText('Rerun Status Checks')).toBeInTheDocument();
    expect(screen.queryByText('Re-approve')).not.toBeInTheDocument();
  });
});

describe('SnapshotHeaderContent force approve', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('force approves a failed comparison after confirmation', async () => {
    const approveMock = MockApiClient.addMockResponse({
      url: APPROVE_URL,
      method: 'POST',
      match: [MockApiClient.matchData({feature_type: 'snapshots'})],
      statusCode: 201,
      body: {detail: 'Approved'},
    });

    renderActions({comparison_state: 'failed', approval_status: null});
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    await userEvent.click(await screen.findByText('Force Approve'));

    expect(await screen.findByText('Force approve snapshots')).toBeInTheDocument();
    expect(approveMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Force approve'}));

    await waitFor(() => expect(approveMock).toHaveBeenCalledTimes(1));
  });

  it('offers force approve for a no-base build', async () => {
    renderActions({comparison_state: 'no_base_build', approval_status: null});
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    expect(await screen.findByText('Force Approve')).toBeInTheDocument();
  });

  it('does not offer force approve for a successful comparison', async () => {
    renderActions({comparison_state: 'success', approval_status: 'requires_approval'});
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    expect(await screen.findByText('Rerun Status Checks')).toBeInTheDocument();
    expect(screen.queryByText('Force Approve')).not.toBeInTheDocument();
  });

  it('does not offer force approve while waiting for base', async () => {
    renderActions({comparison_state: 'waiting_for_base', approval_status: null});
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    expect(await screen.findByText('Rerun Status Checks')).toBeInTheDocument();
    expect(screen.queryByText('Force Approve')).not.toBeInTheDocument();
  });

  it('offers re-approve but not force approve once force approved', async () => {
    renderActions({comparison_state: 'failed', approval_status: 'approved'});
    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    expect(await screen.findByText('Re-approve')).toBeInTheDocument();
    expect(screen.queryByText('Force Approve')).not.toBeInTheDocument();
  });
});

describe('SnapshotHeaderContent breadcrumbs', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('names the page after the artifact id, under a Snapshots crumb', () => {
    renderActions();

    expect(screen.getByRole('heading', {level: 1, name: ARTIFACT_ID})).toBeVisible();
    expect(screen.getByRole('link', {name: 'Snapshots'})).toBeInTheDocument();
  });

  it('renders the page title before the snapshot has loaded', () => {
    render(
      <SnapshotHeaderContent
        snapshotId={ARTIFACT_ID}
        organizationSlug={ORG_SLUG}
        apiUrl={API_URL}
      />,
      {organization: OrganizationFixture({slug: ORG_SLUG})}
    );

    expect(screen.getByRole('heading', {level: 1, name: ARTIFACT_ID})).toBeVisible();
    expect(screen.queryByRole('button', {name: 'More actions'})).not.toBeInTheDocument();
  });

  it('offers Approve only while approval is required', () => {
    renderActions({comparison_state: 'success', approval_status: 'requires_approval'});
    expect(screen.getByRole('button', {name: 'Approve'})).toBeInTheDocument();
  });

  it('does not offer Approve once approved', () => {
    renderActions({comparison_state: 'success', approval_status: 'approved'});
    expect(screen.queryByRole('button', {name: 'Approve'})).not.toBeInTheDocument();
  });
});
