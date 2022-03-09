import {
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {StackTracePreview} from 'sentry/components/stacktracePreview';
import {EntryType, Event} from 'sentry/types/event';
import useApi from 'sentry/utils/useApi';

const makeEvent = (event: Partial<Event> = {}): Event => {
  const evt: Event = {
    ...TestStubs.Event(),
    ...event,
  };

  return evt;
};

jest.mock('sentry/utils/useApi');

describe('StackTracePreview', () => {
  it('fetches from projects when eventId and projectSlug are provided', async () => {
    const api = new MockApiClient();

    const spy = jest
      .spyOn(api, 'requestPromise')
      .mockResolvedValue(makeEvent({id: 'event_id', entries: []}));

    // @ts-ignore useApi is mocked
    useApi.mockReturnValue(api);

    mountWithTheme(
      <StackTracePreview
        issueId="issue"
        eventId="event_id"
        projectSlug="project_slug"
        organization={TestStubs.Organization({slug: 'org_slug'})}
      >
        Preview Trigger
      </StackTracePreview>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    await waitFor(() => {
      expect(spy.mock.calls[0][0]).toBe(
        `/projects/org_slug/project_slug/events/event_id/`
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

    mountWithTheme(
      <StackTracePreview
        issueId="issue"
        organization={TestStubs.Organization({slug: 'org_slug'})}
      >
        Preview Trigger
      </StackTracePreview>
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

    mountWithTheme(
      <StackTracePreview
        issueId="issue"
        organization={TestStubs.Organization({slug: 'org_slug'})}
      >
        Preview Trigger
      </StackTracePreview>
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

    mountWithTheme(
      <StackTracePreview
        issueId="issue"
        organization={TestStubs.Organization({slug: 'org_slug'})}
      >
        Preview Trigger
      </StackTracePreview>
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
    jest.spyOn(api, 'requestPromise').mockResolvedValue(
      makeEvent({
        id: 'event_id',
        entries: [
          {
            // @ts-ignore, tbc what would be the right type here?
            type: EntryType.EXCEPTION,
            data: {
              values: [
                {
                  stacktrace: {
                    hasSystemFrames: false,
                    registers: {},
                    framesOmitted: 0,
                    frames: [
                      {colNo: 0, filename: 'file.js', function: 'throwError', lineNo: 0},
                    ],
                  },
                },
              ],
            },
          },
        ],
      })
    );

    // @ts-ignore useApi is mocked
    useApi.mockReturnValue(api);

    mountWithTheme(
      <StackTracePreview
        issueId="issue"
        organization={TestStubs.Organization({
          slug: 'org_slug',
          features,
        })}
      >
        Preview Trigger
      </StackTracePreview>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByTestId(component)).toBeInTheDocument();
  });
});
