import {EventFixture} from 'sentry-fixture/event';
import {EventStacktraceFrameFixture} from 'sentry-fixture/eventStacktraceFrame';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NativeDisplayOptions} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {
  getNativeDisplayOptionDefaults,
  useNativeDisplayOptionsStorage,
} from 'sentry/components/stackTrace/native/nativeDisplayOptionsPersistence';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {localStorageWrapper} from 'sentry/utils/localStorage';

describe('NativeStackTraceProvider', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const storageKey = 'issue-details-stracktrace-display-org-slug-project-slug';
  const stacktrace: StacktraceType = {
    framesOmitted: null,
    hasSystemFrames: false,
    registers: null,
    frames: [],
  };
  const stacktraceWithAddress: StacktraceType = {
    framesOmitted: null,
    hasSystemFrames: false,
    registers: null,
    frames: [
      EventStacktraceFrameFixture({
        filename: 'main.m',
        function: 'main',
        instructionAddr: '0x1000',
        platform: 'cocoa',
      }),
    ],
  };

  beforeEach(() => {
    localStorageWrapper.removeItem(storageKey);
  });

  function PersistedNativeStackTrace({
    children,
    hasMinifiedStacktrace = false,
    stacktrace: stacktraceProp = stacktrace,
  }: {
    children: React.ReactNode;
    hasMinifiedStacktrace?: boolean;
    stacktrace?: StacktraceType;
  }) {
    const [persistedOptions] = useNativeDisplayOptionsStorage(storageKey);
    const {defaultIsMinified, defaultView} = getNativeDisplayOptionDefaults({
      hasMinifiedStacktrace,
      persistedOptions,
    });

    return (
      <StackTraceViewStateProvider
        hasMinifiedStacktrace={hasMinifiedStacktrace}
        platform="cocoa"
        defaultView={defaultView}
        defaultIsMinified={defaultIsMinified}
      >
        <NativeStackTraceProvider
          event={EventFixture({platform: 'cocoa'})}
          stacktrace={stacktraceProp}
          displayOptionsStorageKey={storageKey}
        >
          {children}
        </NativeStackTraceProvider>
      </StackTraceViewStateProvider>
    );
  }

  it('hydrates raw and minified display options from persisted storage', async () => {
    localStorageWrapper.setItem(
      storageKey,
      JSON.stringify(['raw-stack-trace', 'minified'])
    );

    render(
      <PersistedNativeStackTrace hasMinifiedStacktrace>
        <RawDownloadAction
          eventId="event-id"
          organization={organization}
          projectSlug="project-slug"
          threadId={123}
        />
      </PersistedNativeStackTrace>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Download'})).toHaveAttribute(
        'href',
        '/projects/org-slug/project-slug/events/event-id/apple-crash-report?minified=true&thread_id=123&download=1'
      );
    });
  });

  it('persists native display options to storage', async () => {
    render(
      <PersistedNativeStackTrace stacktrace={stacktraceWithAddress}>
        <NativeDisplayOptions />
      </PersistedNativeStackTrace>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(
      await screen.findByRole('option', {name: 'Absolute Addresses'})
    );

    await waitFor(() => {
      expect(JSON.parse(localStorageWrapper.getItem(storageKey)!)).toEqual([
        'absolute-addresses',
      ]);
    });
  });
});
