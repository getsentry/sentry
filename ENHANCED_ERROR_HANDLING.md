# Enhanced Error Handling Solution

This document outlines the comprehensive error handling solution implemented to improve error tracking, categorization, and user experience across the Sentry application.

## Overview

The enhanced error handling solution addresses common issues in the Sentry codebase by providing:

1. **Better Error Categorization**: Automatically categorizes errors for improved grouping and analysis
2. **Enhanced Error Reporting**: Provides more context and better fingerprinting for Sentry events
3. **Improved User Experience**: User-friendly error messages and better UI feedback
4. **Consistent Error Handling**: Standardized error handling patterns across the codebase

## Components

### 1. Enhanced API Error Handling (`src/sentry/utils/error_handling.py`)

The core utility module that provides enhanced error handling capabilities for the backend.

#### Key Features:
- **Error Categorization**: Automatically categorizes errors into meaningful groups
- **Enhanced Fingerprinting**: Provides consistent fingerprints for better error grouping
- **Context Management**: Enriches error reports with additional context
- **User-Friendly Messages**: Translates technical errors into user-friendly messages

#### Usage:

```python
from sentry.utils.error_handling import (
    ErrorHandler, 
    enhanced_error_handling, 
    handle_api_error,
    with_enhanced_error_handling
)

# Context manager usage
with enhanced_error_handling(context={"operation": "database_query"}):
    # Your code here
    pass

# API error handling
response = handle_api_error(
    exc=exception,
    request=request,
    handler_context={"endpoint": "/api/endpoint"}
)

# Decorator usage
@with_enhanced_error_handling(capture_exceptions=True)
def my_function():
    # Your code here
    pass
```

#### Error Categories:
- `rate_limit`: Rate limiting errors
- `query_error`: Database/Snuba query errors
- `database_error`: Database operation errors
- `integration_error`: Third-party API errors
- `validation_error`: Input validation errors
- `network_error`: Network connection errors
- `permission_error`: Authorization/permission errors
- `authentication_error`: Authentication failures
- `internal_error`: General internal errors

### 2. Enhanced Frontend Error Boundary (`static/app/utils/enhancedErrorBoundary.tsx`)

A React error boundary component that provides better error handling and user feedback.

#### Key Features:
- **Error Categorization**: Categorizes frontend errors for better grouping
- **Enhanced UI**: Provides user-friendly error messages and recovery options
- **Sentry Integration**: Improved error reporting with better context
- **Customizable**: Supports custom error messages and fallback components

#### Usage:

```typescript
import EnhancedErrorBoundary, { 
  withEnhancedErrorBoundary, 
  useErrorHandler 
} from 'sentry/utils/enhancedErrorBoundary';

// Basic usage
<EnhancedErrorBoundary>
  <MyComponent />
</EnhancedErrorBoundary>

// With custom options
<EnhancedErrorBoundary
  showDetails={true}
  customErrorMessage="Something went wrong with this feature"
  sentryContext={{feature: "user_dashboard"}}
>
  <MyComponent />
</EnhancedErrorBoundary>

// HOC usage
const EnhancedComponent = withEnhancedErrorBoundary(MyComponent, {
  showDetails: true,
  sentryContext: {feature: "settings"}
});

// Hook usage in functional components
function MyFunctionalComponent() {
  const { error, handleError, clearError } = useErrorHandler();
  
  const handleClick = () => {
    try {
      // risky operation
    } catch (err) {
      handleError(err, {context: "button_click"});
    }
  };
  
  return (
    <div>
      {error && <ErrorMessage error={error} onClose={clearError} />}
      <button onClick={handleClick}>Click me</button>
    </div>
  );
}
```

### 3. Updated Base API Endpoint (`src/sentry/api/base.py`)

The base API endpoint now uses the enhanced error handling utilities for consistent error handling across all API endpoints.

#### Key Improvements:
- **Consistent Error Handling**: All API endpoints now use the same error handling pattern
- **Better Error Categorization**: Automatic error categorization with appropriate HTTP status codes
- **Enhanced Context**: More context information in error reports
- **User-Friendly Messages**: Clearer error messages for API consumers

## Implementation Details

### Backend Error Handling Flow

1. **Error Occurs**: An exception is raised in the application
2. **Categorization**: The error is automatically categorized based on its type
3. **Context Enrichment**: Additional context is added to the error report
4. **Fingerprinting**: A consistent fingerprint is generated for better grouping
5. **Sentry Capture**: The error is captured and sent to Sentry with enhanced context
6. **User Response**: A user-friendly error message is returned to the client

### Frontend Error Handling Flow

1. **Error Occurs**: A JavaScript error occurs in the React component tree
2. **Error Boundary**: The enhanced error boundary catches the error
3. **Categorization**: The error is categorized based on its characteristics
4. **Context Addition**: Additional context is added to the error report
5. **Sentry Capture**: The error is captured with enhanced fingerprinting
6. **User Feedback**: A user-friendly error UI is displayed with recovery options

## Best Practices

### For Backend Development

1. **Use Context Managers**: Wrap risky operations in `enhanced_error_handling` context managers
2. **Add Context**: Always provide relevant context when handling errors
3. **Custom Error Messages**: Use appropriate error messages for different error categories
4. **Proper Logging**: Use structured logging with error categories

```python
# Good
with enhanced_error_handling(
    context={"operation": "user_creation", "user_id": user.id}
):
    create_user_account(user)

# Better
from sentry.utils.error_handling import log_error_with_context

try:
    process_payment(payment_data)
except PaymentError as e:
    log_error_with_context(
        e, 
        "Payment processing failed", 
        context={"payment_id": payment_data.id, "amount": payment_data.amount}
    )
    raise
```

### For Frontend Development

1. **Wrap Components**: Use error boundaries around major component trees
2. **Add Context**: Provide meaningful context to error reports
3. **Custom Fallbacks**: Create custom error fallback components for important features
4. **Error Recovery**: Provide users with clear recovery options

```typescript
// Good
<EnhancedErrorBoundary sentryContext={{feature: "dashboard"}}>
  <Dashboard />
</EnhancedErrorBoundary>

// Better
<EnhancedErrorBoundary 
  sentryContext={{
    feature: "dashboard",
    user_id: user.id,
    organization_id: organization.id
  }}
  customErrorMessage="Unable to load dashboard. Please try refreshing the page."
  fallback={DashboardErrorFallback}
>
  <Dashboard />
</EnhancedErrorBoundary>
```

## Error Monitoring and Analysis

### Sentry Tags Added

The enhanced error handling adds several tags to help with error monitoring:

- `error_category`: The categorized error type
- `endpoint`: The API endpoint where the error occurred
- `user_agent`: The user agent string
- `exception_type`: The specific exception type
- `error_boundary`: The React error boundary that caught the error
- `component_stack`: The React component stack trace

### Error Fingerprinting

Enhanced fingerprinting ensures similar errors are grouped together:

- **Backend**: `[category, exception_type, specific_context]`
- **Frontend**: `[react-error-boundary, category, error_name, boundary_name]`

## Performance Considerations

1. **Error Context**: Be mindful of the amount of context added to error reports
2. **Async Operations**: Handle async errors properly to avoid unhandled rejections
3. **Memory Usage**: The enhanced error boundary cleans up properly to prevent memory leaks
4. **Rate Limiting**: Error reporting respects Sentry's rate limiting to avoid overwhelming the service

## Testing

### Backend Tests

```python
def test_error_handling():
    from sentry.utils.error_handling import ErrorHandler
    
    # Test error categorization
    error = ValueError("Invalid input")
    category = ErrorHandler.categorize_error(error)
    assert category == "validation_error"
    
    # Test fingerprinting
    fingerprint = ErrorHandler.get_error_fingerprint(error, category)
    assert fingerprint == ["validation_error", "ValueError"]
```

### Frontend Tests

```typescript
import { render, screen } from '@testing-library/react';
import EnhancedErrorBoundary from 'sentry/utils/enhancedErrorBoundary';

const ThrowError = () => {
  throw new Error('Test error');
};

test('displays error boundary UI', () => {
  render(
    <EnhancedErrorBoundary>
      <ThrowError />
    </EnhancedErrorBoundary>
  );
  
  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  expect(screen.getByText('Try Again')).toBeInTheDocument();
});
```

## Migration Guide

### Existing Error Handlers

1. **Replace manual error handling**: Replace existing manual error handling with the enhanced utilities
2. **Update error boundaries**: Replace existing error boundaries with the enhanced error boundary
3. **Add context**: Add relevant context to existing error handling code
4. **Update tests**: Update tests to work with the new error handling patterns

### Gradual Migration

1. **Start with new code**: Use enhanced error handling in all new code
2. **Update critical paths**: Prioritize updating error handling in critical code paths
3. **Monitor improvements**: Use Sentry to monitor improvements in error reporting
4. **Full migration**: Gradually migrate all error handling code

## Troubleshooting

### Common Issues

1. **Missing Context**: Ensure all error handling includes relevant context
2. **Fingerprint Collisions**: Adjust fingerprinting if errors are being grouped incorrectly
3. **Performance Impact**: Monitor for performance impact of enhanced error handling
4. **Sentry Quotas**: Monitor Sentry usage to ensure quotas aren't exceeded

### Debug Mode

In development mode, additional debug information is included in error responses:

```json
{
  "detail": "Query failed to execute. Please try with different parameters.",
  "errorId": "abc123",
  "errorCategory": "query_error",
  "debug": {
    "exception_type": "SnubaError",
    "exception_message": "Query timeout",
    "traceback": "..."
  }
}
```

## Conclusion

The enhanced error handling solution provides a comprehensive approach to error management in the Sentry application. By implementing consistent error categorization, enhanced reporting, and improved user experience, this solution will help reduce debugging time and improve overall application reliability.

For questions or issues with the enhanced error handling solution, please refer to the implementation files or consult the development team.