import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ReplayBulkViewedActions} from 'sentry/components/replays/table/replayBulkViewedActions';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ListCheckboxQueryKeyRef} from 'sentry/utils/list/useListItemCheckboxState';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

jest.mock('sentry/utils/analytics');

const mockTrackAnalytics = jest.mocked(trackAnalytics);

const mockFetchMutation = jest.fn().mockResolvedValue({});

jest.mock('sentry/utils/queryClient', () => ({
  ...jest.requireActual('sentry/utils/queryClient'),
  get fetchMutation() {
    return mockFetchMutation;
  },
}));

const mockAddErrorMessage = jest.fn();
const mockAddSuccessMessage = jest.fn();

jest.mock('sentry/actionCreators/indicator', () => ({
  get addErrorMessage() {
    return mockAddErrorMessage;
  },
  get addSuccessMessage() {
    return mockAddSuccessMessage;
  },
}));

function createReplay(overrides?: Partial<ReplayListRecord>): ReplayListRecord {
  return {
    id: 'a1',
    project_id: '2',
    has_viewed: false,
    is_archived: false,
    ...overrides,
  } as ReplayListRecord;
}

describe('ReplayBulkViewedActions', () => {
  const organization = OrganizationFixture({slug: 'acme-corp'});
  const replay = createReplay();

  const deselectAll = jest.fn();
  const apiUrl = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/',
    {
      path: {
        organizationIdOrSlug: organization.id,
        projectIdOrSlug: 2,
        replayId: replay.id,
      },
    }
  );
  const queryKey: ApiQueryKey = [apiUrl, {}, {infinite: false}];
  const queryKeyRef = {current: queryKey};

  const renderWithOrganization = (
    overrides: {
      queryKeyRef?: ListCheckboxQueryKeyRef;
      replays?: ReplayListRecord[];
      selectedIds?: string[];
    } = {}
  ) =>
    render(
      <ReplayBulkViewedActions
        deselectAll={deselectAll}
        queryKeyRef={overrides.queryKeyRef ?? queryKeyRef}
        replays={overrides.replays ?? [replay]}
        selectedIds={overrides.selectedIds ?? [replay.id]}
      />,
      {organization}
    );

  beforeEach(() => {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([ProjectFixture({slug: 'proj-a'})]);
  });

  it('shows a total-success toast when all viewed-by requests succeed', async () => {
    const replay1 = createReplay({id: 'a1'});
    const replay2 = createReplay({
      id: 'b2',
      project_id: '2',
    });

    renderWithOrganization({
      replays: [replay1, replay2],
      selectedIds: [replay1.id, replay2.id],
    });

    await userEvent.click(screen.getByRole('button', {name: /mark as viewed/i}));

    await waitFor(() => {
      expect(deselectAll).toHaveBeenCalled();
    });
    expect(mockAddErrorMessage).not.toHaveBeenCalled();
    expect(mockAddSuccessMessage).toHaveBeenCalledWith('Marked 2 replays as viewed.');
    expect(mockTrackAnalytics).toHaveBeenCalledWith('replay.bulk_mark_viewed', {
      organization: expect.objectContaining({slug: 'acme-corp'}),
      failed: 0,
      succeeded: 2,
      multiProject: false,
    });
  });

  it('sets multiProject in analytics to true when sent replays differ in project', async () => {
    const replay1 = createReplay({
      id: 'a1',
      project_id: '1',
    });
    const replay2 = createReplay({
      id: 'b2',
      project_id: '2',
    });

    renderWithOrganization({
      replays: [replay1, replay2],
      selectedIds: [replay1.id, replay2.id],
    });

    await userEvent.click(screen.getByRole('button', {name: /mark as viewed/i}));

    await waitFor(() => {
      expect(deselectAll).toHaveBeenCalled();
    });
    expect(mockTrackAnalytics).toHaveBeenCalledWith('replay.bulk_mark_viewed', {
      organization: expect.objectContaining({slug: 'acme-corp'}),
      failed: 0,
      succeeded: 2,
      multiProject: true,
    });
  });

  it('shows a partial-failure toast when one viewed-by request fails and one succeeds', async () => {
    mockFetchMutation
      .mockImplementationOnce(() => Promise.resolve({}))
      .mockImplementationOnce(() => Promise.reject(new Error('Oh no!')));

    const replay1 = createReplay({id: 'r1'});
    const replay2 = createReplay({id: 'r2'});

    renderWithOrganization({
      replays: [replay1, replay2],
      selectedIds: [replay1.id, replay2.id],
    });

    await userEvent.click(screen.getByRole('button', {name: /mark as viewed/i}));

    await waitFor(() => {
      expect(deselectAll).toHaveBeenCalled();
    });
    expect(mockAddSuccessMessage).not.toHaveBeenCalled();
    expect(mockAddErrorMessage.mock.calls[0]![0]).toMatch(/Updated/);
    expect(mockAddErrorMessage.mock.calls[0]![0]).toMatch(/2/);
    expect(mockTrackAnalytics).toHaveBeenCalledWith('replay.bulk_mark_viewed', {
      organization: expect.anything(),
      failed: 1,
      succeeded: 1,
      multiProject: false,
    });
  });

  it('shows a total-failure toast when the viewed-by request is rejected', async () => {
    mockFetchMutation.mockImplementation(() => Promise.reject(new Error('Oh no!')));

    renderWithOrganization();

    await userEvent.click(screen.getByRole('button', {name: /mark as viewed/i}));

    await waitFor(() => {
      expect(mockAddErrorMessage).toHaveBeenCalledWith(
        'Replays could not be updated. Try again or refresh the list.'
      );
    });
    expect(mockAddSuccessMessage).not.toHaveBeenCalled();
    expect(deselectAll).not.toHaveBeenCalled();
    expect(mockTrackAnalytics).toHaveBeenCalledWith('replay.bulk_mark_viewed', {
      organization: expect.objectContaining({slug: 'acme-corp'}),
      failed: 1,
      succeeded: 0,
      multiProject: false,
    });
  });
});
