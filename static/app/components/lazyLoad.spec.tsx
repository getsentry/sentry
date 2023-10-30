import {render, screen} from 'sentry-test/reactTestingLibrary';

import LazyLoad from 'sentry/components/lazyLoad';

type TestProps = {
  testProp?: boolean;
};

function FooComponent({}: TestProps) {
  return <div>my foo component</div>;
}

function BarComponent({}: TestProps) {
  return <div>my bar component</div>;
}

type ResolvedComponent = {default: React.ComponentType<TestProps>};
type GetComponent = () => Promise<ResolvedComponent>;

describe('LazyLoad', function () {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders with a loading indicator when promise is not resolved yet', function () {
    const importTest = new Promise<ResolvedComponent>(() => {});
    const getComponent = () => importTest;
    render(<LazyLoad component={getComponent} />);

    // Should be loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders when given a promise of a "foo" component', async function () {
    let doResolve: (c: ResolvedComponent) => void;
    const importFoo = new Promise<ResolvedComponent>(resolve => {
      doResolve = resolve;
    });

    render(<LazyLoad component={() => importFoo} />);

    // Should be loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // resolve with foo
    doResolve!({default: FooComponent});
    expect(await screen.findByText('my foo component')).toBeInTheDocument();
  });

  it('renders with error message when promise is rejected', async function () {
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
    const getComponent = jest.fn(
      () =>
        new Promise<ResolvedComponent>((_resolve, reject) =>
          reject(new Error('Could not load component'))
        )
    );

    try {
      render(<LazyLoad component={getComponent} />);
    } catch (err) {
      // ignore
    }

    expect(
      await screen.findByText('There was an error loading a component.')
    ).toBeInTheDocument();

    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
  });

  it('refetches only when component changes', async function () {
    let doResolve: (c: ResolvedComponent) => void;
    const importFoo = new Promise<ResolvedComponent>(resolve => {
      doResolve = resolve;
    });

    // First render Foo
    const {rerender} = render(<LazyLoad component={() => importFoo} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // resolve with foo
    doResolve!({default: FooComponent});
    expect(await screen.findByText('my foo component')).toBeInTheDocument();

    // Re-render with Bar
    const importBar = new Promise<ResolvedComponent>(resolve => {
      doResolve = resolve;
    });

    rerender(<LazyLoad component={() => importBar} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // resolve with bar
    doResolve!({default: BarComponent});
    expect(await screen.findByText('my bar component')).toBeInTheDocument();

    // Update component prop to a mock to make sure it isn't re-called
    const getComponent2: GetComponent = jest.fn(
      () => new Promise<ResolvedComponent>(() => {})
    );
    rerender(<LazyLoad component={getComponent2} />);
    expect(getComponent2).toHaveBeenCalledTimes(1);

    // Does not refetch on other prop changes
    rerender(<LazyLoad component={getComponent2} testProp />);
    expect(getComponent2).toHaveBeenCalledTimes(1);
  });
});
