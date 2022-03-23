import * as React from 'react';
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import useAsync from 'sentry/utils/useAsync';
import {RouteContext} from 'sentry/views/routeContext';

describe('useAsync', () => {
  describe('error handling', () => {
    function HomePage() {
      const {renderComponent, data} = useAsync({
        endpoints: [['message', '/some/path/to/something/']],
        shouldRenderBadRequests: true,
      });
      return renderComponent(<div>{data.message?.value}</div>);
    }

    function UniqueErrorsAsyncComponent() {
      const {renderComponent, data} = useAsync({
        endpoints: [
          ['first', '/first/path/'],
          ['second', '/second/path/'],
          ['third', '/third/path/'],
        ],
        shouldRenderBadRequests: true,
      });

      return renderComponent(<div>{data.message?.value}</div>);
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

    function App() {
      return (
        <Router
          history={memoryHistory}
          render={props => {
            return (
              <RouteContext.Provider value={props}>
                <RouterContext {...props} />
              </RouteContext.Provider>
            );
          }}
        >
          <Route path="/" component={HomePage} />
          <Route path="/unique-error" component={UniqueErrorsAsyncComponent} />
        </Router>
      );
    }
    it('renders on successful request', async function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/some/path/to/something/',
        method: 'GET',
        body: {
          value: 'hi',
        },
      });
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('hi')).toBeInTheDocument();
      });
    });

    it('renders error message', async function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/some/path/to/something/',
        method: 'GET',
        body: {
          detail: 'oops there was a problem',
        },
        statusCode: 400,
      });
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('oops there was a problem')).toBeInTheDocument();
      });
    });

    it('renders only unique error message', async function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/first/path/',
        method: 'GET',
        body: {
          detail: 'oops there was a problem',
        },
        statusCode: 400,
      });
      MockApiClient.addMockResponse({
        url: '/second/path/',
        method: 'GET',
        body: {
          detail: 'oops there was a problem',
        },
        statusCode: 400,
      });
      MockApiClient.addMockResponse({
        url: '/third/path/',
        method: 'GET',
        body: {
          detail: 'oops there was a different problem',
        },
        statusCode: 400,
      });

      memoryHistory.push('/unique-error');

      render(<App />);
      await waitFor(() => {
        expect(screen.getByTestId('loading-error-message')).toHaveTextContent(
          'oops there was a problem'
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('loading-error-message')).toHaveTextContent(
          'oops there was a different problem'
        );
      });
    });
  });

  describe('slow requests', () => {
    it('calls onLoadAllEndpointsSuccess when all endpoints have been loaded', async () => {
      const requestQueue: Array<() => void> = [];

      jest.spyOn(MockApiClient.prototype, 'request').mockImplementation((_, options) => {
        requestQueue.push(() => {
          return options?.success?.({message: 'good'});
        });
      });

      const mockOnAllEndpointsSuccess = jest.fn();

      function MultiRouteComponent() {
        const {remainingRequests} = useAsync({
          endpoints: [
            ['data', '/some/path/to/something/'],
            ['project', '/another/path/here'],
          ],
          onLoadAllEndpointsSuccess: mockOnAllEndpointsSuccess,
        });
        return <div data-test-id="remaining-requests">{remainingRequests}</div>;
      }
      const memoryHistory = createMemoryHistory();
      memoryHistory.push('/multi');

      function App() {
        return (
          <Router
            history={memoryHistory}
            render={props => {
              return (
                <RouteContext.Provider value={props}>
                  <RouterContext {...props} />
                </RouteContext.Provider>
              );
            }}
          >
            <Route path="/multi" component={MultiRouteComponent} />
          </Router>
        );
      }
      render(<App />);

      expect(await screen.findByText('2')).toBeInTheDocument();

      const req1 = requestQueue.shift();
      req1?.();
      expect(await screen.findByText('1')).toBeInTheDocument();

      const req2 = requestQueue.shift();
      req2?.();
      expect(await screen.findByText('0')).toBeInTheDocument();

      expect(mockOnAllEndpointsSuccess).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });
});
