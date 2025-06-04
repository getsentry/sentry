import {ReplayConsoleFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbLevelType} from 'sentry/types/breadcrumbs';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
import MessageFormatter from 'sentry/views/replays/detail/console/messageFormatter';

describe('MessageFormatter', () => {
  it('Should print console message with placeholders correctly', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: ['This is a %s', 'test'],
          logger: 'console',
        },
        level: BreadcrumbLevelType.LOG,
        message: 'This is a %s test',
        timestamp: new Date('2022-06-22T20:00:39.959Z'),
      }),
    ]);

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('This is a test')).toBeInTheDocument();
  });

  it('Should print console message without data', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        level: BreadcrumbLevelType.LOG,
        message: 'This is only a test',
        timestamp: new Date('2022-06-22T20:00:39.959Z'),
      }),
    ]);

    // Manually delete `data` from the mock.
    // This is reasonable because the type, at this point, `frame` is of type
    // `BreadcrumbFrame` and not `ConsoleFrame`.
    // When the type is narrowed to `ConsoleFrame` the `data` field is forced to exist.
    delete frame!.data;

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('This is only a test')).toBeInTheDocument();
  });

  it('Should print console message with objects correctly', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: ['test', 1, false, {}],
          logger: 'console',
        },
        level: BreadcrumbLevelType.LOG,
        message: 'test 1 false [object Object]',
        timestamp: new Date('2022-06-22T16:49:11.198Z'),
      }),
    ]);

    const {container} = render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('test 1 false')).toBeInTheDocument();
    expect(container).toHaveTextContent('{}');
  });

  it('Should print console message correctly when it is an Error object', async function () {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: [{}],
          logger: 'console',
        },
        level: BreadcrumbLevelType.ERROR,
        message: 'Error: this is my error message',
        timestamp: new Date('2022-06-22T20:00:39.958Z'),
      }),
    ]);

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('1 item')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: '1 item'}));
    expect(screen.getByText('this is my error message')).toBeInTheDocument();
  });

  it('Should print empty object in case there is no message prop', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: [{}],
          logger: 'console',
        },
        level: BreadcrumbLevelType.ERROR,
        timestamp: new Date('2022-06-22T20:00:39.958Z'),
      }),
    ]);

    const {container} = render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(container).toHaveTextContent('{}');
  });

  it('Should style "%c" placeholder and print the console message correctly', async function () {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: [
            '%c prev state',
            'color: #9E9E9E; font-weight: bold; background-image: url(foo);',
            {
              cart: [],
            },
          ],
          logger: 'console',
        },
        level: BreadcrumbLevelType.LOG,
        message:
          '%c prev state color: #9E9E9E; font-weight: bold; background-image: url(foo); [object Object]',
        timestamp: new Date('2022-06-09T00:50:25.273Z'),
      }),
    ]);

    const {container} = render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    const styledEl = screen.getByText('prev state');
    expect(styledEl).toBeInTheDocument();
    expect(styledEl).toHaveStyle('color: #9E9E9E;');
    expect(styledEl).toHaveStyle('font-weight: bold;');
    expect(styledEl).not.toHaveStyle('background-image: url(foo);');
    expect(screen.getByText('1 item')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: '1 item'}));
    expect(container).toHaveTextContent('cart: []');
  });

  it('Should print arrays correctly', async function () {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: ['test', ['foo', 'bar']],
          logger: 'console',
        },
        level: BreadcrumbLevelType.LOG,
        message: 'test foo,bar',
        timestamp: new Date('2022-06-23T17:09:31.158Z'),
      }),
    ]);

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: '2 items'}));
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('Should print literal %', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: ['This is a literal 100%'],
          logger: 'console',
        },
        level: BreadcrumbLevelType.LOG,
        message: 'This is a literal 100%',
        timestamp: new Date('2022-06-22T20:00:39.959Z'),
      }),
    ]);

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('This is a literal 100%')).toBeInTheDocument();
  });

  it('Should print unbound %s placeholder', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: ['Unbound placeholder %s'],
          logger: 'console',
        },
        level: BreadcrumbLevelType.LOG,
        message: 'Unbound placeholder %s',
        timestamp: new Date('2022-06-22T20:00:39.959Z'),
      }),
    ]);

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('Unbound placeholder %s')).toBeInTheDocument();
  });

  it('Should print placeholder with literal %', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayConsoleFrameFixture({
        data: {
          arguments: ['Placeholder %s with 100%', 'myPlaceholder'],
          logger: 'console',
        },
        level: BreadcrumbLevelType.LOG,
        message: 'Placeholder %s with 100%',
        timestamp: new Date('2022-06-22T20:00:39.959Z'),
      }),
    ]);

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('Placeholder myPlaceholder with 100%')).toBeInTheDocument();
  });

  it('should print non-console breadcrumbs', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      {
        category: 'cypress',
        message: 'custom breadcrumb',
        timestamp: new Date('2022-06-22T20:00:39.959Z').getTime(),
        type: 'info',
      },
    ]);

    render(<MessageFormatter frame={frame!} onExpand={() => {}} />);

    expect(screen.getByText('cypress custom breadcrumb')).toBeInTheDocument();
  });
});
