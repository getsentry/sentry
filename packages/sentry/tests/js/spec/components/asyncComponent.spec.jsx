import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';

describe('AsyncComponent', function () {
  class TestAsyncComponent extends AsyncComponent {
    shouldRenderBadRequests = true;

    constructor(props) {
      super(props);
      this.state = {};
    }

    getEndpoints() {
      return [['data', '/some/path/to/something/']];
    }

    renderBody() {
      return <div>{this.state.data.message}</div>;
    }
  }

  it('renders on successful request', function () {
    Client.clearMockResponses();
    Client.addMockResponse({
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
    Client.clearMockResponses();
    Client.addMockResponse({
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
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/first/path/',
      method: 'GET',
      body: {
        detail: 'oops there was a problem',
      },
      statusCode: 400,
    });
    Client.addMockResponse({
      url: '/second/path/',
      method: 'GET',
      body: {
        detail: 'oops there was a problem',
      },
      statusCode: 400,
    });
    Client.addMockResponse({
      url: '/third/path/',
      method: 'GET',
      body: {
        detail: 'oops there was a different problem',
      },
      statusCode: 400,
    });

    class UniqueErrorsAsyncComponent extends AsyncComponent {
      shouldRenderBadRequests = true;

      getEndpoints() {
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
      getEndpoints() {
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
      jest.spyOn(Client.prototype, 'request').mockImplementation((url, options) => {
        const timeout = url.includes('something') ? 100 : 50;
        setTimeout(
          () =>
            options.success({
              message: 'good',
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

      jest.advanceTimersByTime(40);
      expect(screen.getByTestId('remaining-requests')).toHaveTextContent('2');

      jest.advanceTimersByTime(40);
      expect(screen.getByTestId('remaining-requests')).toHaveTextContent('1');
      expect(mockOnAllEndpointsSuccess).not.toHaveBeenCalled();

      jest.advanceTimersByTime(40);
      expect(screen.queryByTestId('remaining-requests')).not.toBeInTheDocument();
      expect(mockOnAllEndpointsSuccess).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});
