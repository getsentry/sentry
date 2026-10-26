import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {makeSentryContinuousProfile} from 'sentry/utils/profiling/profile/testUtils';
import {ProfileGroupProvider} from 'sentry/views/explore/profiling/profileGroupProvider';

import {
  type SpanProfileDetailsMetadata,
  useSpanProfileDetails,
} from './spanProfileDetails';

const organization = OrganizationFixture();

function Wrapper({children}: React.PropsWithChildren) {
  return (
    <ProfileGroupProvider
      input={makeSentryContinuousProfile()}
      traceID="profiler-id"
      type="flamechart"
    >
      {children}
    </ProfileGroupProvider>
  );
}

describe('useSpanProfileDetails', () => {
  it('prefers the profile timestamp over the fallback origin', () => {
    const metadata: SpanProfileDetailsMetadata = {
      endTimestamp: 3,
      profileId: undefined,
      profilerId: 'profiler-id',
      profileStartTimestamp: 0,
      projectId: '1',
      projectSlug: 'project',
      startTimestamp: 2,
      traceId: 'trace-id',
    };
    const input = makeSentryContinuousProfile({
      profile: {
        samples: [
          {timestamp: 1, stack_id: 0, thread_id: '0'},
          {timestamp: 2, stack_id: 1, thread_id: '0'},
          {timestamp: 3, stack_id: 1, thread_id: '0'},
        ],
        frames: [
          {function: 'foo', in_app: true, lineno: 1},
          {function: 'bar', in_app: true, lineno: 2},
        ],
        stacks: [
          [0, 0],
          [1, 1],
        ],
      },
    });
    const {result} = renderHookWithProviders(
      () =>
        useSpanProfileDetails(organization, metadata, {
          start_timestamp: 2,
          end_timestamp: 3,
          span_id: 'span-id',
          thread_id: '0',
        }),
      {
        organization,
        additionalWrapper: ({children}) => (
          <ProfileGroupProvider input={input} traceID="profiler-id" type="flamechart">
            {children}
          </ProfileGroupProvider>
        ),
      }
    );

    expect(result.current.profile?.timestamp).toBe(1);
    expect(new Set(result.current.frames.map(frame => frame.function))).toEqual(
      new Set(['bar'])
    );
  });

  it.each([undefined, 'transaction-span-id'])(
    'keeps event and span IDs separate in continuous profile links (span ID: %s)',
    transactionSpanId => {
      const metadata: SpanProfileDetailsMetadata = {
        endTimestamp: 2,
        profileId: undefined,
        profilerId: 'profiler-id',
        projectId: '1',
        projectSlug: 'project',
        startTimestamp: 1,
        traceId: 'trace-id',
        transactionId: 'transaction-event-id',
        transactionSpanId,
      };

      const {result} = renderHookWithProviders(
        () =>
          useSpanProfileDetails(organization, metadata, {
            end_timestamp: 2,
            span_id: 'span-id',
            start_timestamp: 1,
            thread_id: '0',
          }),
        {organization, additionalWrapper: Wrapper}
      );

      expect(result.current.profileTarget).toEqual(
        expect.objectContaining({
          query: expect.objectContaining({
            end: new Date(2100).toISOString(),
            profilerId: 'profiler-id',
            spanId: 'span-id',
            start: new Date(900).toISOString(),
            tid: '0',
            traceId: 'trace-id',
            ...(transactionSpanId
              ? {transactionId: transactionSpanId}
              : {eventId: 'transaction-event-id'}),
          }),
        })
      );
      expect(result.current.profileTarget).toEqual(
        expect.objectContaining({
          query: expect.not.objectContaining({
            [transactionSpanId ? 'eventId' : 'transactionId']: expect.anything(),
          }),
        })
      );
      expect(result.current.profileEvent.eventID).toBe('transaction-event-id');
      expect(result.current.profileEvent.id).toBe('transaction-event-id');
    }
  );
});
