import React from 'react';

import RouteError from 'app/views/routeError';

type State = {
  hasError: boolean;
  error: Error | undefined;
};

export default function errorHandler<P>(Component: React.ComponentType<P>) {
  class ErrorHandler extends React.Component<P, State> {
    static getDerivedStateFromError(error: Error) {
      // Update state so the next render will show the fallback UI.
      return {
        hasError: true,
        error,
      };
    }

    state = {
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

      return <Component {...this.props} />;
    }
  }

  return ErrorHandler;
}
