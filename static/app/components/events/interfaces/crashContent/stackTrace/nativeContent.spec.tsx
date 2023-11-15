import {EventEntryStacktrace} from 'sentry-fixture/eventEntryStacktrace';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {EventOrGroupType} from 'sentry/types';
import {StacktraceType} from 'sentry/types/stacktrace';

const eventEntryStacktrace = EventEntryStacktrace();
const event = TestStubs.Event({
  entries: [eventEntryStacktrace],
  type: EventOrGroupType.ERROR,
});

const data = eventEntryStacktrace.data as Required<StacktraceType>;

function renderedComponent(
  props: Partial<React.ComponentProps<typeof StackTraceContent>>
) {
  return render(
    <StackTraceContent
      data={data}
      className="no-exception"
      platform="other"
      event={event}
      newestFirst
      includeSystemFrames
      {...props}
    />
  );
}
describe('Native StackTrace', function () {
  beforeEach(() => {
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: promptResponse,
    });
  });
  it('does not render non in app tags', function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: false};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
    });

    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('displays a toggle button when there is more than one non-inapp frame', function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: true};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
      includeSystemFrames: false,
    });

    expect(screen.getByText('Show 3 more frames')).toBeInTheDocument();
  });

  it('shows/hides frames when toggle button clicked', async function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: true};
    dataFrames[1] = {...dataFrames[1], function: 'non-in-app-frame'};
    dataFrames[2] = {...dataFrames[2], function: 'non-in-app-frame'};
    dataFrames[3] = {...dataFrames[3], function: 'non-in-app-frame'};
    dataFrames[4] = {...dataFrames[4], function: 'non-in-app-frame'};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
      includeSystemFrames: false,
    });
    await userEvent.click(screen.getByText('Show 3 more frames'));
    expect(screen.getAllByText('non-in-app-frame')).toHaveLength(4);
    await userEvent.click(screen.getByText('Hide 3 more frames'));
    expect(screen.getByText('non-in-app-frame')).toBeInTheDocument();
  });

  it('does not display a toggle button when there is only one non-inapp frame', function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: true};
    dataFrames[2] = {...dataFrames[2], inApp: true};
    dataFrames[4] = {...dataFrames[4], inApp: true};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      data: newData,
      includeSystemFrames: false,
    });

    expect(screen.queryByText(/Show .* more frames*/)).not.toBeInTheDocument();
  });
});
