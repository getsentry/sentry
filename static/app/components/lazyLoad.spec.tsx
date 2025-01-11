import {lazy} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import LazyLoad from 'sentry/components/lazyLoad';

type TestProps = {
  testProp?: boolean;
};

function FooComponent() {
  return <div>my foo component</div>;
}

function BarComponent() {
  return <div>my bar component</div>;
}

type ResolvedComponent = {default: React.ComponentType<TestProps>};

describe('LazyLoad', function () {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders with a loading indicator when promise is not resolved yet', function () {
    const importTest = new Promise<ResolvedComponent>(() => {});
    const getComponent = () => importTest;
    render(<LazyLoad LazyComponent={lazy(getComponent)} />);

    // Should be loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders when given a promise of a "foo" component', async function () {
    let doResolve: (c: ResolvedComponent) => void;
    const importFoo = new Promise<ResolvedComponent>(resolve => {
      doResolve = resolve;
    });

    render(<LazyLoad LazyComponent={lazy(() => importFoo)} />);

    // Should be loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // resolve with foo
    doResolve!({default: FooComponent});
    expect(await screen.findByText('my foo component')).toBeInTheDocument();
  });

  it('renders with error message when promise is rejected', async function () {
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
    const getComponent = () => Promise.reject(new Error('Could not load component'));

    render(<LazyLoad LazyComponent={lazy(getComponent)} />);

    expect(
      await screen.findByText('There was an error loading a component.', undefined, {
        timeout: 5000,
      })
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
    const {rerender} = render(<LazyLoad LazyComponent={lazy(() => importFoo)} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // resolve with foo
    doResolve!({default: FooComponent});
    expect(await screen.findByText('my foo component')).toBeInTheDocument();

    // Re-render with Bar
    const importBar = new Promise<ResolvedComponent>(resolve => {
      doResolve = resolve;
    });

    rerender(<LazyLoad LazyComponent={lazy(() => importBar)} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // resolve with bar
    doResolve!({default: BarComponent});
    expect(await screen.findByText('my bar component')).toBeInTheDocument();

    // Update component prop to a mock to make sure it isn't re-called
    const getComponent2 = jest.fn(() => new Promise<ResolvedComponent>(() => {}));
    const LazyGet = lazy(getComponent2);
    rerender(<LazyLoad LazyComponent={LazyGet} />);
    expect(getComponent2).toHaveBeenCalledTimes(1);

    // Does not refetch on other prop changes
    rerender(<LazyLoad LazyComponent={LazyGet} testProp />);
    expect(getComponent2).toHaveBeenCalledTimes(1);
  });
});
