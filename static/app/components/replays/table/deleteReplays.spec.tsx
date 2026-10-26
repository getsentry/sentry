import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DeleteReplays} from 'sentry/components/replays/table/deleteReplays';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

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

function rejectWith(responseJSON: Record<string, unknown>) {
  mockFetchMutation.mockRejectedValue(
    new RequestError('POST', '/delete/', new Error('Bad Request'), {
      getResponseHeader: () => null,
      responseJSON,
      responseText: JSON.stringify(responseJSON),
      status: 400,
      statusText: 'Bad Request',
    })
  );
}

describe('DeleteReplays', () => {
  const organization = OrganizationFixture({access: ['project:write']});
  const replay = createReplay();

  beforeEach(() => {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([ProjectFixture({id: '2', slug: 'proj-a'})]);
    mockFetchMutation.mockReset().mockResolvedValue({});
  });

  const renderDeleteReplays = () =>
    render(
      <DeleteReplays
        queryOptions={{query: {statsPeriod: '90d'}}}
        replays={[replay]}
        selectedIds={[replay.id]}
      />,
      {organization}
    );

  it('shows the returned range error when the request exceeds the 30 day limit', async () => {
    rejectWith({
      data: {
        non_field_errors: ['you cannot delete more than 30 days of data at a time'],
      },
    });

    renderDeleteReplays();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    await waitFor(() => {
      expect(mockAddErrorMessage).toHaveBeenCalledWith(
        'Failed to delete replay: you cannot delete more than 30 days of data at a time'
      );
    });
  });

  it('shows the generic error when the response has no readable message', async () => {
    rejectWith({});

    renderDeleteReplays();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    await waitFor(() => {
      expect(mockAddErrorMessage).toHaveBeenCalledWith('Failed to delete replay');
    });
  });
});
