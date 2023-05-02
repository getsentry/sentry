import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ExceptionStacktraceContent from 'sentry/components/events/interfaces/crashContent/exception/stackTrace';
import {STACK_VIEW} from 'sentry/types/stacktrace';

const frames = [
  {
    function: null,
    colNo: null,
    vars: {},
    symbol: null,
    module: '<unknown module>',
    lineNo: null,
    errors: null,
    package: null,
    absPath: 'https://sentry.io/hiventy/kraken-prod/issues/438681831/?referrer=slack#',
    inApp: false,
    instructionAddr: null,
    filename: '/hiventy/kraken-prod/issues/438681831/',
    platform: null,
    context: [],
    symbolAddr: null,
    rawFunction: null,
    trust: null,
  },
  {
    absPath: 'foo/baz.c',
    colNo: null,
    context: [],
    errors: null,
    filename: 'foo/baz.c',
    function: null,
    inApp: false,
    instructionAddr: null,
    lineNo: 1,
    module: null,
    package: null,
    platform: null,
    rawFunction: null,
    symbol: null,
    symbolAddr: null,
    trust: null,
    vars: null,
  },
];

const stacktrace: React.ComponentProps<typeof ExceptionStacktraceContent>['stacktrace'] =
  {
    framesOmitted: null,
    hasSystemFrames: false,
    registers: {},
    frames,
  };

const props: React.ComponentProps<typeof ExceptionStacktraceContent> = {
  platform: 'node',
  expandFirstFrame: true,
  newestFirst: true,
  chainedException: false,
  event: {
    ...TestStubs.Event(),
    entries: [],
    crashFile: {
      sha1: 'sha1',
      name: 'name.dmp',
      dateCreated: '2019-05-21T18:01:48.762Z',
      headers: {'Content-Type': 'application/octet-stream'},
      id: '12345',
      size: 123456,
      type: 'event.minidump',
    },
    culprit: '',
    dateCreated: '2019-05-21T18:00:23Z',
    'event.type': 'error',
    eventID: '123456',
    groupID: '1',
    id: '98654',
    location: 'main.js',
    message: 'TestException',
    platform: 'native',
    projectID: '123',
    tags: [{value: 'production', key: 'production'}],
    title: 'TestException',
  },
  data: stacktrace,
  stacktrace,
  hasHierarchicalGrouping: false,
  groupingCurrentLevel: undefined,
  meta: undefined,
};

describe('ExceptionStacktraceContent', function () {
  it('default behaviour', function () {
    const {container} = render(<ExceptionStacktraceContent {...props} />);

    expect(container).toSnapshot();
  });

  it('should return an emptyRender', function () {
    const {container} = render(
      <ExceptionStacktraceContent {...props} stacktrace={null} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows stack trace', function () {
    render(
      <ExceptionStacktraceContent
        {...props}
        stackView={STACK_VIEW.APP}
        chainedException={false}
        stacktrace={{...stacktrace, frames: []}}
      />
    );

    expect(
      screen.getByText('No app only stack trace has been found!')
    ).toBeInTheDocument();
  });

  it('does not show stack trace', function () {
    render(
      <ExceptionStacktraceContent
        {...props}
        stacktrace={{...stacktrace, frames: [{...frames[0], inApp: true}, frames[1]]}}
      />
    );
    expect(
      screen.getByText(textWithMarkupMatcher('foo/baz.c at line 1'))
    ).toBeInTheDocument();
  });

  it('should render system frames if "stackView: app" and there are no inApp frames and is a chained exceptions', function () {
    render(
      <ExceptionStacktraceContent
        {...props}
        stackView={STACK_VIEW.APP}
        chainedException
      />
    );

    for (const frame of frames) {
      expect(screen.getByText(frame.filename)).toBeInTheDocument();
    }
  });

  it('should not render system frames if "stackView: app" and there are inApp frames and is a chained exceptions', () => {
    render(
      <ExceptionStacktraceContent
        {...props}
        stacktrace={{...stacktrace, frames: [{...frames[0], inApp: true}, frames[1]]}}
        chainedException
      />
    );

    // There must be two elements, one being the inApp frame and the other
    // the last frame which is non-app frame
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    // inApp === true
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(frames[0].filename);

    // inApp === false
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(frames[1].filename);
  });
});
