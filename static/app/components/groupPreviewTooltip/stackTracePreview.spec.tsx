import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EventError, Organization} from 'sentry/types';
import {EntryType, Event, ExceptionType, ExceptionValue, Frame} from 'sentry/types/event';
import useApi from 'sentry/utils/useApi';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

import {StackTracePreview} from './stackTracePreview';

const makeEvent = (event: Partial<Event> = {}): Event => {
  const evt: Event = {
    ...TestStubs.Event(),
    ...event,
  };

  return evt;
};

function TestComponent({org, children}: {children: React.ReactNode; org?: Organization}) {
  const {organization, router} = initializeOrg();

  return (
    <OrganizationContext.Provider value={org ?? organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

jest.mock('sentry/utils/useApi');

describe('StackTracePreview', () => {
  it('fetches from projects when eventId and projectSlug are provided', async () => {
    const api = new MockApiClient();

    const spy = jest
      .spyOn(api, 'requestPromise')
      .mockResolvedValue(makeEvent({id: 'event_id', entries: []}));

    // @ts-ignore useApi is mocked
    useApi.mockReturnValue(api);

    render(
      <TestComponent>
        <StackTracePreview issueId="issue" eventId="event_id" projectSlug="project_slug">
          Preview Trigger
        </StackTracePreview>
      </TestComponent>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    await waitFor(() => {
      expect(spy.mock.calls[0][0]).toBe(
        `/projects/org-slug/project_slug/events/event_id/`
      );
    });
  });

  it('fetches from issues when issueId when eventId and projectSlug are not provided', async () => {
    const api = new MockApiClient();
    const spy = jest
      .spyOn(api, 'requestPromise')
      .mockResolvedValue(makeEvent({id: 'event_id', entries: []}));

    // @ts-ignore useApi is mocked
    useApi.mockReturnValue(api);

    render(
      <TestComponent>
        <StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>
      </TestComponent>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    await waitFor(() => {
      expect(spy.mock.calls[0][0]).toBe(
        `/issues/issue/events/latest/?collapse=stacktraceOnly`
      );
    });
  });

  it('renders error message', async () => {
    const api = new MockApiClient();
    jest
      .spyOn(api, 'requestPromise')
      .mockRejectedValue(makeEvent({id: 'event_id', entries: []}));

    // @ts-ignore useApi is mocked
    useApi.mockReturnValue(api);

    render(
      <TestComponent>
        <StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>
      </TestComponent>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByText(/Failed to load stack trace/)).toBeInTheDocument();
  });

  it('warns about no stacktrace', async () => {
    const api = new MockApiClient();
    jest
      .spyOn(api, 'requestPromise')
      .mockResolvedValue(makeEvent({id: 'event_id', entries: []}));

    // @ts-ignore useApi is mocked
    useApi.mockReturnValue(api);

    render(
      <TestComponent>
        <StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>
      </TestComponent>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(
      await screen.findByText(/There is no stack trace available for this issue./)
    ).toBeInTheDocument();
  });

  it.each([
    ['stack-trace-content', []],
    ['stack-trace-content-v2', ['grouping-stacktrace-ui']],
  ])('renders %s', async (component, features) => {
    const api = new MockApiClient();

    const frame: Frame = {
      colNo: 0,
      filename: 'file.js',
      function: 'throwError',
      lineNo: 0,
      absPath: null,
      context: [],
      errors: null,
      inApp: false,
      instructionAddr: null,
      module: null,
      package: null,
      platform: null,
      rawFunction: null,
      symbol: null,
      symbolAddr: null,
      trust: undefined,
      vars: null,
    };
    const thread: ExceptionValue = {
      stacktrace: {
        hasSystemFrames: false,
        registers: {},
        framesOmitted: 0,
        frames: [frame],
      },
      mechanism: null,
      module: null,
      rawStacktrace: null,
      threadId: null,
      type: '',
      value: '',
    };

    const exceptionValue: ExceptionType = {
      values: [thread],
      excOmitted: undefined,
      hasSystemFrames: false,
    };

    const errorEvent: EventError = {
      id: 'event_id',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: exceptionValue,
        },
      ],
    } as EventError;

    jest.spyOn(api, 'requestPromise').mockResolvedValue(makeEvent(errorEvent));

    // @ts-ignore useApi is mocked
    useApi.mockReturnValue(api);

    render(
      <TestComponent org={TestStubs.Organization({features})}>
        <StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>
      </TestComponent>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByTestId(component)).toBeInTheDocument();
  });
});
