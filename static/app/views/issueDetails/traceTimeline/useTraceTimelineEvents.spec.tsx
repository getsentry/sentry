import type {ReactNode} from 'react';
import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {HIDDEN_OCCURRENCE_TYPE_IDS} from 'sentry/types/group';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import type {TraceEventResponse} from './useTraceTimelineEvents';
import {useTraceTimelineEvents} from './useTraceTimelineEvents';

describe('useTraceTimelineEvents', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const event = EventFixture({
    contexts: {
      trace: {
        trace_id: '123',
      },
    },
  });

  function TestWrapper({children}: {children?: ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  }

  const emptyResponse: TraceEventResponse = {
    data: [],
    meta: {fields: {}, units: {}},
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  it('excludes hidden issue types from issuePlatform query', async () => {
    const mockIssuePlatform = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyResponse,
      match: [MockApiClient.matchQuery({dataset: 'issuePlatform'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: emptyResponse,
      match: [MockApiClient.matchQuery({dataset: 'discover'})],
    });

    renderHook(() => useTraceTimelineEvents({event}), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(mockIssuePlatform).toHaveBeenCalled();
    });

    if (HIDDEN_OCCURRENCE_TYPE_IDS.length > 0) {
      expect(mockIssuePlatform).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining(
              `!occurrence_type_id:[${HIDDEN_OCCURRENCE_TYPE_IDS.join(',')}]`
            ),
          }),
        })
      );
    } else {
      expect(mockIssuePlatform).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.not.stringContaining('!occurrence_type_id:'),
          }),
        })
      );
    }
  });
});
