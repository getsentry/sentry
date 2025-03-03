import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useSourceMapDebuggerData} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

const queryClient = makeTestQueryClient();

function renderMockRequests({
  orgSlug,
  projectSlug,
  eventID,
}: {
  eventID: string;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
}) {
  const sourceMapDebugBlueThunderEdition = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/events/${
      eventID
    }/source-map-debug-blue-thunder-edition/`,
    method: 'GET',
    body: [],
  });

  return {sourceMapDebugBlueThunderEdition};
}

function Wrapper({
  organization,
  children,
}: {
  children: React.ReactNode;
  organization: Organization;
}) {
  return (
    <OrganizationContext.Provider value={organization}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </OrganizationContext.Provider>
  );
}

describe('useSourceMapDebuggerData', function () {
  it('shall return false for SDKs without Debug ID support', function () {
    const event = EventFixture({sdk: {name: 'sentry.javascript.cordova'}});
    const organization = OrganizationFixture();

    const {sourceMapDebugBlueThunderEdition} = renderMockRequests({
      orgSlug: organization.slug,
      projectSlug: 'project-slug',
      eventID: event.id,
    });

    const {result} = renderHook(() => useSourceMapDebuggerData(event, 'project-slug'), {
      wrapper: ({children}) => <Wrapper organization={organization}>{children}</Wrapper>,
    });
    expect(result.current).toBeUndefined();
    expect(sourceMapDebugBlueThunderEdition).not.toHaveBeenCalled();
  });

  it('shall return true for SDKs with Debug ID support', function () {
    const event = EventFixture({sdk: {name: 'sentry.javascript.react'}});
    const organization = OrganizationFixture();

    const {sourceMapDebugBlueThunderEdition} = renderMockRequests({
      orgSlug: organization.slug,
      projectSlug: 'project-slug',
      eventID: event.id,
    });

    const {result} = renderHook(() => useSourceMapDebuggerData(event, 'project-slug'), {
      wrapper: ({children}) => <Wrapper organization={organization}>{children}</Wrapper>,
    });
    expect(result.current).toBeUndefined();
    expect(sourceMapDebugBlueThunderEdition).toHaveBeenCalled();
  });
});
