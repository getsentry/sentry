import React from 'react';
import RouteError from 'app/views/routeError';

export default function errorHandler(Component) {
  class ErrorHandler extends React.Component {
    static getDerivedStateFromError(error) {
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
      error: null,
    };

    componentDidCatch(error, info) {
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
