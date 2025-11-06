import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Link} from 'sentry/components/core/link/link';
import {PRELOAD_HANDLE} from 'sentry/router/preload';
import {RouteConfigProvider} from 'sentry/router/routeConfigContext';

import {makeLazyloadComponent} from './makeLazyloadComponent';

// Mock component to be lazy loaded
function MockComponent(props: {title: string; count?: number}) {
  return (
    <div data-test-id="mock-component">
      <h1>{props.title}</h1>
      {props.count && <span>Count: {props.count}</span>}
    </div>
  );
}

// Mock component factory
const createMockComponentPromise =
  (component = MockComponent, delay = 0) =>
  () =>
    new Promise<{default: typeof component}>(resolve => {
      setTimeout(() => resolve({default: component}), delay);
    });

describe('makeLazyloadComponent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('lazy loading functionality', () => {
    it('renders lazy component after loading', async () => {
      const LazyComponent = makeLazyloadComponent(createMockComponentPromise());

      render(<LazyComponent title="Test Title" />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('passes props correctly to lazy component', async () => {
      const LazyComponent = makeLazyloadComponent(createMockComponentPromise());

      render(<LazyComponent title="Test Title" count={42} />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Count: 42')).toBeInTheDocument();
    });

    it('shows loading fallback during lazy loading', async () => {
      const loadingFallback = <div data-test-id="loading">Loading...</div>;
      const LazyComponent = makeLazyloadComponent(
        createMockComponentPromise(MockComponent, 100),
        loadingFallback
      );

      render(<LazyComponent title="Test Title" />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      // Loading fallback should be gone
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    it('handles loading errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorResolver = () => Promise.reject(new Error('Load failed'));
      const LazyComponent = makeLazyloadComponent(errorResolver);

      // Should not throw when rendering
      render(<LazyComponent title="Test Title" />);

      await waitFor(() => {
        expect(
          screen.getByText('There was an error loading a component.')
        ).toBeInTheDocument();
      });
      expect(consoleSpy).toHaveBeenCalledWith(new Error('Load failed'));
    });
  });

  describe('preload functionality', () => {
    it('adds preload method to component', () => {
      const LazyComponent = makeLazyloadComponent(createMockComponentPromise());

      expect(LazyComponent).toHaveProperty(PRELOAD_HANDLE);
      expect(typeof LazyComponent[PRELOAD_HANDLE]).toBe('function');
    });

    it('preload method returns a promise', async () => {
      const LazyComponent = makeLazyloadComponent(createMockComponentPromise());

      const preloadPromise = LazyComponent[PRELOAD_HANDLE]();
      expect(preloadPromise).toBeInstanceOf(Promise);

      // Fast-forward timers to resolve the promise
      jest.runAllTimers();

      const result = await preloadPromise;
      expect(result).toHaveProperty('default');
      expect(result.default).toBe(MockComponent);
    });

    it('renders without suspense when preloaded', async () => {
      const LazyComponent = makeLazyloadComponent(
        createMockComponentPromise(MockComponent, 50)
      );

      // Preload the component
      const preloadPromise = LazyComponent[PRELOAD_HANDLE]();

      // Fast-forward timers to resolve preload
      jest.advanceTimersByTime(50);

      await preloadPromise;

      // Render should be immediate without loading state
      render(<LazyComponent title="Preloaded Component" />);

      // Component should be immediately available
      expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      expect(screen.getByText('Preloaded Component')).toBeInTheDocument();
    });

    it('shares the same promise between preload and lazy loading', async () => {
      let callCount = 0;
      const resolver = () => {
        callCount++;
        return Promise.resolve({default: MockComponent});
      };

      const LazyComponent = makeLazyloadComponent(resolver);

      // Call preload first
      const preloadPromise = LazyComponent[PRELOAD_HANDLE]();

      // Render component (which should use the same promise)
      render(<LazyComponent title="Shared Promise Test" />);

      await act(() => preloadPromise);
      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      expect(callCount).toBe(1);
    });

    it('handles preload errors without affecting component rendering', async () => {
      let shouldError = true;
      const conditionalResolver = () => {
        if (shouldError) {
          return Promise.reject(new Error('Preload failed'));
        }
        return Promise.resolve({default: MockComponent});
      };

      const LazyComponent = makeLazyloadComponent(conditionalResolver);

      // Preload should fail
      await waitFor(async () => {
        await expect(act(() => LazyComponent[PRELOAD_HANDLE]())).rejects.toThrow(
          'Preload failed'
        );
      });

      // But subsequent rendering attempts should still work
      shouldError = false;
      render(<LazyComponent title="Error Recovery Test" />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });
    });

    it('multiple preload calls return the same promise', async () => {
      const LazyComponent = makeLazyloadComponent(createMockComponentPromise());

      const promise1 = LazyComponent[PRELOAD_HANDLE]();
      const promise2 = LazyComponent[PRELOAD_HANDLE]();
      const promise3 = LazyComponent[PRELOAD_HANDLE]();

      // All promises should be the same instance
      expect(promise1).toBe(promise2);
      expect(promise2).toBe(promise3);

      // Fast-forward timers to resolve the promise
      jest.runAllTimers();

      const result = await promise1;
      expect(result.default).toBe(MockComponent);
    });

    it('preload is idempotent - calling multiple times has same effect', async () => {
      let callCount = 0;
      const resolver = () => {
        callCount++;
        return Promise.resolve({default: MockComponent});
      };

      const LazyComponent = makeLazyloadComponent(resolver);

      // Call preload multiple times
      const promises = [
        LazyComponent[PRELOAD_HANDLE](),
        LazyComponent[PRELOAD_HANDLE](),
        LazyComponent[PRELOAD_HANDLE](),
      ];

      jest.runAllTimers();

      await Promise.all(promises);

      expect(callCount).toBe(1);
    });
  });

  describe('route integration', () => {
    beforeEach(() => {
      jest.useRealTimers();
    });
    it('works with Link component route preloading', async () => {
      const LazyComponent = makeLazyloadComponent(
        createMockComponentPromise(MockComponent, 50)
      );

      // Create mock routes that include our lazy component
      const mockRoutes = [
        {
          path: '/test-route',
          element: <div>Route wrapper</div>,
          handle: {
            [PRELOAD_HANDLE]: LazyComponent[PRELOAD_HANDLE],
          },
        },
      ];

      // Render a Link that should trigger preloading
      render(
        <RouteConfigProvider value={mockRoutes}>
          <div>
            <Link to="/test-route" data-test-id="test-link">
              Go to test route
            </Link>
            <LazyComponent title="Test Component" />
          </div>
        </RouteConfigProvider>
      );

      const link = screen.getByTestId('test-link');

      // Initially, component should show loading (not preloaded yet)
      expect(screen.queryByTestId('mock-component')).not.toBeInTheDocument();

      // Hover over link to trigger preload
      await userEvent.hover(link);

      // Wait for component to load after preload
      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });

    it('handles multiple routes with different preload handles', async () => {
      const LazyComponent1 = makeLazyloadComponent(() =>
        Promise.resolve({
          default: (props: {title: string}) => (
            <div data-test-id="component-1">{props.title}</div>
          ),
        })
      );

      const LazyComponent2 = makeLazyloadComponent(() =>
        Promise.resolve({
          default: (props: {title: string}) => (
            <div data-test-id="component-2">{props.title}</div>
          ),
        })
      );

      // Mock routes with nested structure
      const mockRoutes = [
        {
          path: '/parent',
          element: <div>Parent</div>,
          handle: {
            [PRELOAD_HANDLE]: LazyComponent1[PRELOAD_HANDLE],
          },
          children: [
            {
              path: 'child',
              element: <div>Child</div>,
              handle: {
                [PRELOAD_HANDLE]: LazyComponent2[PRELOAD_HANDLE],
              },
            },
          ],
        },
      ];

      render(
        <RouteConfigProvider value={mockRoutes}>
          <div>
            <Link to="/parent/child" data-test-id="nested-link">
              Go to nested route
            </Link>
            <LazyComponent1 title="Component 1" />
            <LazyComponent2 title="Component 2" />
          </div>
        </RouteConfigProvider>
      );

      await userEvent.hover(screen.getByTestId('nested-link'));

      await waitFor(() => {
        expect(screen.getByTestId('component-1')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByTestId('component-2')).toBeInTheDocument();
      });
    });

    it('gracefully handles routes without preload handles', async () => {
      const LazyComponent = makeLazyloadComponent(createMockComponentPromise());

      const mockRoutes = [
        {
          path: '/no-preload',
          element: <div>No preload</div>,
          handle: {
            name: 'No preload route',
          },
        },
      ];

      render(
        <RouteConfigProvider value={mockRoutes}>
          <div>
            <Link to="/no-preload" data-test-id="no-preload-link">
              No preload route
            </Link>
            <LazyComponent title="Test Component" />
          </div>
        </RouteConfigProvider>
      );

      // Should not throw when hovering
      await userEvent.hover(screen.getByTestId('no-preload-link'));

      // Component should still load normally when rendered
      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });
    });

    it('handles route config provider errors gracefully', async () => {
      const LazyComponent = makeLazyloadComponent(createMockComponentPromise());

      // For this test, we'll use empty routes to simulate no route config
      render(
        <RouteConfigProvider value={[]}>
          <div>
            <Link to="/error-route" data-test-id="error-link">
              Error route
            </Link>
            <LazyComponent title="Test Component" />
          </div>
        </RouteConfigProvider>
      );

      // Should not throw when hovering, even with failing route config
      await userEvent.hover(screen.getByTestId('error-link'));

      // Component should still load normally
      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });
    });
  });
});
