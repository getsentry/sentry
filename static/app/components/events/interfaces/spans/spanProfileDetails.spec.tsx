import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {makeSentryContinuousProfile} from 'sentry/utils/profiling/profile/testUtils';
import {ProfileGroupProvider} from 'sentry/views/explore/profiling/profileGroupProvider';

import {
  type SpanProfileDetailsContext,
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
  it('uses the padded span range and EAP transaction context in continuous profile links', () => {
    const context: SpanProfileDetailsContext = {
      endTimestamp: 2,
      profileId: undefined,
      profilerId: 'profiler-id',
      projectId: '1',
      projectSlug: 'project',
      startTimestamp: 1,
      traceId: 'trace-id',
      transactionId: 'transaction-id',
    };

    const {result} = renderHook(
      () =>
        useSpanProfileDetails(organization, context, {
          end_timestamp: 2,
          span_id: 'span-id',
          start_timestamp: 1,
          thread_id: '0',
        }),
      {wrapper: Wrapper}
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
          transactionId: 'transaction-id',
        }),
      })
    );
  });
});
