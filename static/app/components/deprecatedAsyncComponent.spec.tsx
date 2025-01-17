import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';

describe('DeprecatedAsyncComponent', function () {
  class TestAsyncComponent extends DeprecatedAsyncComponent {
    shouldRenderBadRequests = true;

    getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
      return [['data', '/some/path/to/something/']];
    }

    renderBody() {
      return <div>{this.state.data.message}</div>;
    }
  }

  it('renders on successful request', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/some/path/to/something/',
      method: 'GET',
      body: {
        message: 'hi',
      },
    });
    render(<TestAsyncComponent />);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('renders error message', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/some/path/to/something/',
      method: 'GET',
      body: {
        detail: 'oops there was a problem',
      },
      statusCode: 400,
    });
    render(<TestAsyncComponent />);
    expect(screen.getByText('oops there was a problem')).toBeInTheDocument();
  });

  it('renders only unique error message', function () {
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

    class UniqueErrorsAsyncComponent extends DeprecatedAsyncComponent {
      shouldRenderBadRequests = true;

      getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
        return [
          ['first', '/first/path/'],
          ['second', '/second/path/'],
          ['third', '/third/path/'],
        ];
      }

      renderBody() {
        return <div>{this.state.data.message}</div>;
      }
    }

    render(<UniqueErrorsAsyncComponent />);

    expect(
      screen.getByText('oops there was a problem oops there was a different problem')
    ).toBeInTheDocument();
  });

  describe('multi-route component', () => {
    class MultiRouteComponent extends TestAsyncComponent {
      getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
        return [
          ['data', '/some/path/to/something/'],
          ['project', '/another/path/here'],
        ];
      }

      renderLoading() {
        return (
          <div data-test-id="remaining-requests">{this.state.remainingRequests}</div>
        );
      }
    }

    it('calls onLoadAllEndpointsSuccess when all endpoints have been loaded', () => {
      jest.useFakeTimers();
      jest
        .spyOn(MockApiClient.prototype, 'request')
        .mockImplementation((url, options) => {
          const timeout = url.includes('something') ? 100 : 50;
          setTimeout(
            () =>
              options?.success?.({message: 'good'}, 'ok', {
                status: 200,
                statusText: 'ok',
                getResponseHeader: () => 'ok',
                responseJSON: {message: 'good'},
                responseText: 'ok',
              }),
            timeout
          );
        });
      const mockOnAllEndpointsSuccess = jest.spyOn(
        MultiRouteComponent.prototype,
        'onLoadAllEndpointsSuccess'
      );

      render(<MultiRouteComponent />);

      expect(screen.getByTestId('remaining-requests')).toHaveTextContent('2');

      act(() => jest.advanceTimersByTime(40));
      expect(screen.getByTestId('remaining-requests')).toHaveTextContent('2');

      act(() => jest.advanceTimersByTime(40));
      expect(screen.getByTestId('remaining-requests')).toHaveTextContent('1');
      expect(mockOnAllEndpointsSuccess).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(40));
      expect(screen.queryByTestId('remaining-requests')).not.toBeInTheDocument();
      expect(mockOnAllEndpointsSuccess).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});
