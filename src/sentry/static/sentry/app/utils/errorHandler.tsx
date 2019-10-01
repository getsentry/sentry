import React from 'react';
import * as Sentry from '@sentry/browser';

import RouteError from 'app/views/routeError';

export default function errorHandler(Component) {
  class ErrorHandler extends React.Component {
    // Update state so the next render will show the fallback UI.
    static getDerivedStateFromError(error: Error) {
      return {
        hasError: true,
        error,
      };
    }

    // we are explicit if an error has been thrown since errors thrown are not guaranteed
    // to be truthy (e.g. throw null).
    state = {
      hasError: false,
      error: null,
    };

    componentDidCatch(error: Error, info: {componentStack: string}) {
      // eslint-disable-next-line no-console
      console.error(
        'Component stack trace caught in <ErrorHandler />:',
        info.componentStack
      );

      Sentry.captureException(error);
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
