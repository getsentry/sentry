import {Component} from 'react';

import RouteError from 'sentry/views/routeError';

type State = {
  error: Error | undefined;
  hasError: boolean;
};

export default function errorHandler<P>(WrappedComponent: React.ComponentType<P>) {
  class ErrorHandler extends Component<P, State> {
    static getDerivedStateFromError(error: Error) {
      // Update state so the next render will show the fallback UI.
      return {
        hasError: true,
        error,
      };
    }

    state: State = {
      // we are explicit if an error has been thrown since errors thrown are not guaranteed
      // to be truthy (e.g. throw null).
      hasError: false,
      error: undefined,
    };

    componentDidCatch(_error: Error, info: React.ErrorInfo) {
      // eslint-disable-next-line no-console
      console.error(
        'Component stack trace caught in <ErrorHandler />:',
        info.componentStack
      );
    }

    render() {
      if (this.state.hasError) {
        return <RouteError error={this.state.error} />;
      }

      // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
      return <WrappedComponent {...(this.props as any)} />;
    }
  }

  return ErrorHandler;
}
