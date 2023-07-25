import {render, screen} from 'sentry-test/reactTestingLibrary';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {EventOrGroupType} from 'sentry/types';
import {StacktraceType} from 'sentry/types/stacktrace';

const eventEntryStacktrace = TestStubs.EventEntryStacktrace();
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
describe('with stacktrace improvements feature flag enabled', function () {
  const organization = TestStubs.Organization({
    features: ['issue-details-stacktrace-improvements'],
  });

  it('does not render non in app tags', function () {
    const dataFrames = [...data.frames];
    dataFrames[0] = {...dataFrames[0], inApp: false};

    const newData = {
      ...data,
      frames: dataFrames,
    };

    renderedComponent({
      organization,
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
      organization,
      data: newData,
      includeSystemFrames: false,
    });

    expect(screen.getByText('Show 3 more frames')).toBeInTheDocument();
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
      organization,
      data: newData,
      includeSystemFrames: false,
    });

    expect(screen.queryByText('more frames')).not.toBeInTheDocument();
    expect(screen.queryByText('more frame')).not.toBeInTheDocument();
  });
});
