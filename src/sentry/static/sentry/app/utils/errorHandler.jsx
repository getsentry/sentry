import React from 'react';
import RouteError from 'app/views/routeError';

export default function errorHandler(Component) {
  class ErrorHandler extends React.Component {
    static getDerivedStateFromError(error) {
      setTimeout(() => {
        throw error;
      });

      // Update state so the next render will show the fallback UI.
      return {
        hasError: true,
        error,
      };
    }

    state = {
      hasError: false,
      error: null,
    };

    render() {
      if (this.state.hasError) {
        return <RouteError error={this.state.error} />;
      }

      return <Component {...this.props} />;
    }
  }

  return ErrorHandler;
}
