import React from 'react';
import * as Sentry from '@sentry/react';
import {Button} from 'sentry/components/button';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {getLastEventId} from 'sentry/utils/integrationUtil';

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorInfo?: React.ErrorInfo;
}

interface Props {
  children: React.ReactNode;
  /**
   * Function to be called when an error occurs
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Whether to show the error details in the UI
   */
  showDetails?: boolean;
  /**
   * Custom error message to display
   */
  customErrorMessage?: string;
  /**
   * Whether to show a report button
   */
  showReportButton?: boolean;
  /**
   * Additional context to send to Sentry
   */
  sentryContext?: Record<string, any>;
  /**
   * Fallback component to render when an error occurs
   */
  fallback?: React.ComponentType<{
    error: Error;
    errorInfo: ErrorInfo;
    resetError: () => void;
  }>;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  hasError: boolean;
}

class EnhancedErrorBoundary extends React.Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      eventId: null,
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const {onError, sentryContext} = this.props;
    
    // Enhanced error info
    const enhancedErrorInfo: ErrorInfo = {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      errorInfo,
    };

    this.setState({
      error,
      errorInfo: enhancedErrorInfo,
    });

    // Call custom error handler
    if (onError) {
      onError(error, enhancedErrorInfo);
    }

    // Enhanced Sentry reporting
    Sentry.withScope(scope => {
      // Set error category for better grouping
      scope.setTag('error_category', this.categorizeError(error));
      scope.setTag('error_boundary', this.constructor.name);
      scope.setTag('component_stack', errorInfo.componentStack);
      
      // Add additional context
      if (sentryContext) {
        Object.entries(sentryContext).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Set user context if available
      scope.setContext('errorBoundary', {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name,
      });

      // Enhanced fingerprinting for better error grouping
      scope.setFingerprint([
        'react-error-boundary',
        this.categorizeError(error),
        error.name,
        this.constructor.name,
      ]);

      try {
        // Create error boundary error similar to the existing implementation
        const errorBoundaryError = new Error(error.message);
        errorBoundaryError.name = `React ErrorBoundary ${errorBoundaryError.name}`;
        errorBoundaryError.stack = errorInfo.componentStack;
        error.cause = errorBoundaryError;
      } catch {
        // Some browsers won't let you write to Error instance
        scope.setExtra('errorInfo', errorInfo);
      }

      const eventId = Sentry.captureException(error);
      this.setState({eventId});
    });
  }

  categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('chunk') || message.includes('loading')) {
      return 'chunk_loading';
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('permission') || message.includes('access')) {
      return 'permission';
    }
    if (stack.includes('redux') || stack.includes('store')) {
      return 'state_management';
    }
    if (stack.includes('router') || stack.includes('route')) {
      return 'routing';
    }
    if (error.name === 'ChunkLoadError') {
      return 'chunk_loading';
    }
    
    return 'general';
  }

  resetError = () => {
    this.setState({
      error: null,
      errorInfo: null,
      eventId: null,
      hasError: false,
    });
  };

  showReportDialog = () => {
    const {eventId} = this.state;
    if (eventId) {
      Sentry.showReportDialog({eventId});
    }
  };

  render() {
    const {
      children,
      showDetails = false,
      customErrorMessage,
      showReportButton = true,
      fallback: FallbackComponent,
    } = this.props;
    const {hasError, error, errorInfo, eventId} = this.state;

    if (hasError && error) {
      // Use custom fallback component if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            errorInfo={errorInfo!}
            resetError={this.resetError}
          />
        );
      }

      // Default error UI
      return (
        <Panel>
          <PanelHeader>{t('Something went wrong')}</PanelHeader>
          <PanelBody>
            <div style={{textAlign: 'center', padding: '20px'}}>
              <h3>{customErrorMessage || t('An unexpected error occurred')}</h3>
              
              <p style={{color: '#666', marginBottom: '20px'}}>
                {t('We apologize for the inconvenience. The error has been logged and we will investigate.')}
              </p>

              {eventId && (
                <p style={{fontSize: '12px', color: '#999', marginBottom: '20px'}}>
                  {t('Error ID: %s', eventId)}
                </p>
              )}

              <div style={{marginBottom: '20px'}}>
                <Button onClick={this.resetError} priority="primary">
                  {t('Try Again')}
                </Button>
                
                {showReportButton && eventId && (
                  <Button 
                    onClick={this.showReportDialog}
                    style={{marginLeft: '10px'}}
                  >
                    {t('Report Issue')}
                  </Button>
                )}
              </div>

              {showDetails && error && (
                <details style={{textAlign: 'left', marginTop: '20px'}}>
                  <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>
                    {t('Error Details')}
                  </summary>
                  <pre style={{
                    backgroundColor: '#f5f5f5',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    marginTop: '10px'
                  }}>
                    <strong>{t('Error:')}</strong> {error.name}: {error.message}
                    {error.stack && (
                      <>
                        <br />
                        <strong>{t('Stack:')}</strong>
                        <br />
                        {error.stack}
                      </>
                    )}
                    {errorInfo?.componentStack && (
                      <>
                        <br />
                        <strong>{t('Component Stack:')}</strong>
                        <br />
                        {errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </details>
              )}
            </div>
          </PanelBody>
        </Panel>
      );
    }

    return children;
  }
}

// Higher-order component for easier usage
export function withEnhancedErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <EnhancedErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </EnhancedErrorBoundary>
    );
  };
}

// Hook for error handling in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error, context?: Record<string, any>) => {
    Sentry.withScope(scope => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      
      scope.setTag('error_handler', 'manual');
      scope.setFingerprint(['manual-error-handler', error.name]);
      
      Sentry.captureException(error);
    });
    
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError,
  };
}

export default EnhancedErrorBoundary;