import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicatorActions from 'sentry/actionCreators/indicator';
import Indicators from 'sentry/components/indicators';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {SnapshotHeaderActions} from 'sentry/views/preprod/snapshots/header/snapshotHeaderActions';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

jest.mock('sentry/utils/downloadFromHref');

const SNAPSHOT_ID = '42';

function makeData(): SnapshotDetailsApiResponse {
  return {
    head_artifact_id: SNAPSHOT_ID,
    project_id: 'project-1',
    comparison_type: 'solo',
    state: 'completed',
    image_count: 0,
    images: [],
    vcs_info: {},
    base_artifact_id: null,
    added: [],
    added_count: 0,
    changed: [],
    changed_count: 0,
    removed: [],
    removed_count: 0,
    unchanged: [],
    unchanged_count: 0,
  } as SnapshotDetailsApiResponse;
}

describe('SnapshotHeaderActions download', () => {
  const organization = OrganizationFixture();
  const STATUS_URL = `/organizations/${organization.slug}/preprodartifacts/snapshots/${SNAPSHOT_ID}/archive/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    indicatorActions.clearIndicators();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('issues each progress toast only once across repeated polls', async () => {
    jest.useFakeTimers();
    const loadingSpy = jest.spyOn(indicatorActions, 'addLoadingMessage');

    let calls = 0;
    MockApiClient.addMockResponse({
      url: STATUS_URL,
      method: 'GET',
      body: () => {
        calls++;
        return {status: 'building', progress: 42};
      },
    });

    render(
      <SnapshotHeaderActions
        apiUrl="/api/0/snapshot/"
        organizationSlug={organization.slug}
        data={makeData()}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More actions'}), {
      advanceTimers: jest.advanceTimersByTime,
    });
    await userEvent.click(screen.getByText('Download Images'), {
      advanceTimers: jest.advanceTimersByTime,
    });

    await waitFor(() => expect(calls).toBe(1));

    act(() => {
      jest.advanceTimersByTime(1_500);
    });
    await waitFor(() => expect(calls).toBe(2));

    const progressCalls = loadingSpy.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes('42%')
    );
    expect(progressCalls).toHaveLength(1);
  });

  it('shows build progress percentage in the toast while preparing', async () => {
    MockApiClient.addMockResponse({
      url: STATUS_URL,
      method: 'GET',
      body: {status: 'building', progress: 42},
    });

    render(
      <Fragment>
        <Indicators />
        <SnapshotHeaderActions
          apiUrl="/api/0/snapshot/"
          organizationSlug={organization.slug}
          data={makeData()}
        />
      </Fragment>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    await userEvent.click(screen.getByText('Download Images'));

    expect(await screen.findByText(/Preparing snapshot images.*42%/)).toBeInTheDocument();
    expect(downloadFromHref).not.toHaveBeenCalled();
  });

  it('polls until ready then triggers download', async () => {
    jest.useFakeTimers();

    let calls = 0;
    MockApiClient.addMockResponse({
      url: STATUS_URL,
      method: 'GET',
      body: () => {
        calls++;
        return {status: calls === 1 ? 'building' : 'ready'};
      },
    });

    render(
      <SnapshotHeaderActions
        apiUrl="/api/0/snapshot/"
        organizationSlug={organization.slug}
        data={makeData()}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More actions'}), {
      advanceTimers: jest.advanceTimersByTime,
    });
    await userEvent.click(screen.getByText('Download Images'), {
      advanceTimers: jest.advanceTimersByTime,
    });

    await waitFor(() => expect(calls).toBe(1));
    expect(downloadFromHref).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1_500);
    });

    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(downloadFromHref).toHaveBeenCalledTimes(1));
    expect(downloadFromHref).toHaveBeenCalledWith(
      `snapshot_images_${SNAPSHOT_ID}.zip`,
      `/api/0/organizations/${organization.slug}/preprodartifacts/snapshots/${SNAPSHOT_ID}/archive/?download=true`
    );

    jest.useRealTimers();
  });
});
