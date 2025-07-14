"""
Enhanced error handling utilities for Sentry.

This module provides consistent error handling patterns, categorization,
and improved error reporting throughout the Sentry codebase.
"""

from __future__ import annotations

import logging
import traceback
from collections.abc import Mapping
from contextlib import contextmanager
from typing import Any, Generator

import sentry_sdk
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import OperationalError
from rest_framework.exceptions import ValidationError, ParseError, Throttled
from rest_framework.response import Response

from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.snuba import SnubaError, RateLimitExceeded
from sentry.utils.sdk import capture_exception

logger = logging.getLogger(__name__)


class ErrorCategory:
    """Constants for error categorization."""
    RATE_LIMIT = "rate_limit"
    QUERY_ERROR = "query_error"
    DATABASE_ERROR = "database_error"
    INTEGRATION_ERROR = "integration_error"
    VALIDATION_ERROR = "validation_error"
    NETWORK_ERROR = "network_error"
    PERMISSION_ERROR = "permission_error"
    AUTHENTICATION_ERROR = "authentication_error"
    INTERNAL_ERROR = "internal_error"


class ErrorHandler:
    """Enhanced error handling utilities."""
    
    @staticmethod
    def categorize_error(exc: Exception) -> str:
        """Categorize exceptions for better error tracking and handling."""
        if isinstance(exc, RateLimitExceeded):
            return ErrorCategory.RATE_LIMIT
        elif isinstance(exc, SnubaError):
            return ErrorCategory.QUERY_ERROR
        elif isinstance(exc, OperationalError):
            return ErrorCategory.DATABASE_ERROR
        elif isinstance(exc, ApiError):
            return ErrorCategory.INTEGRATION_ERROR
        elif isinstance(exc, (ValidationError, ParseError, DjangoValidationError)):
            return ErrorCategory.VALIDATION_ERROR
        elif isinstance(exc, (TimeoutError, ConnectionError)):
            return ErrorCategory.NETWORK_ERROR
        elif isinstance(exc, PermissionError):
            return ErrorCategory.PERMISSION_ERROR
        else:
            return ErrorCategory.INTERNAL_ERROR

    @staticmethod
    def get_error_fingerprint(exc: Exception, category: str, context: dict[str, Any] | None = None) -> list[str]:
        """Generate consistent fingerprints for similar errors."""
        base_fingerprint = [category, type(exc).__name__]
        
        # Add specific fingerprinting for common error types
        if category == ErrorCategory.QUERY_ERROR:
            base_fingerprint.append("snuba")
        elif category == ErrorCategory.DATABASE_ERROR:
            base_fingerprint.append("postgresql")
        elif category == ErrorCategory.INTEGRATION_ERROR:
            base_fingerprint.append("third_party_api")
        elif category == ErrorCategory.RATE_LIMIT:
            base_fingerprint.append("rate_limiting")
        
        # Add context-specific fingerprinting
        if context:
            if endpoint := context.get("endpoint"):
                base_fingerprint.append(endpoint)
        
        return base_fingerprint

    @staticmethod
    def get_user_friendly_error_message(exc: Exception, category: str) -> str:
        """Provide user-friendly error messages based on error category."""
        messages = {
            ErrorCategory.RATE_LIMIT: "Request rate limit exceeded. Please try again later.",
            ErrorCategory.QUERY_ERROR: "Query failed to execute. Please try with different parameters.",
            ErrorCategory.DATABASE_ERROR: "Database operation failed. Please try again.",
            ErrorCategory.INTEGRATION_ERROR: "External service unavailable. Please try again later.",
            ErrorCategory.VALIDATION_ERROR: "Request validation failed. Please check your input.",
            ErrorCategory.NETWORK_ERROR: "Network connection failed. Please check your connection.",
            ErrorCategory.PERMISSION_ERROR: "Permission denied. You don't have access to this resource.",
            ErrorCategory.AUTHENTICATION_ERROR: "Authentication failed. Please check your credentials.",
            ErrorCategory.INTERNAL_ERROR: "Internal server error occurred. Please try again."
        }
        
        return messages.get(category, "An unexpected error occurred. Please try again.")

    @staticmethod
    def create_enhanced_scope(
        exc: Exception,
        category: str,
        context: dict[str, Any] | None = None,
        handler_context: Mapping[str, Any] | None = None,
        base_scope: sentry_sdk.Scope | None = None
    ) -> sentry_sdk.Scope:
        """Create an enhanced Sentry scope with better error categorization."""
        scope = base_scope or sentry_sdk.Scope()
        
        # Add error categorization
        scope.set_tag("error_category", category)
        scope.set_tag("exception_type", type(exc).__name__)
        
        # Add context information
        if context:
            for key, value in context.items():
                scope.set_tag(key, value)
        
        # Add handler context
        if handler_context:
            from sentry.utils.sdk import merge_context_into_scope
            merge_context_into_scope("Request Handler Data", handler_context, scope)
        
        # Set fingerprint for better grouping
        fingerprint = ErrorHandler.get_error_fingerprint(exc, category, context)
        scope.set_fingerprint(fingerprint)
        
        return scope


@contextmanager
def enhanced_error_handling(
    context: dict[str, Any] | None = None,
    capture_exceptions: bool = True,
    reraise: bool = True
) -> Generator[None, None, None]:
    """
    Context manager for enhanced error handling.
    
    Args:
        context: Additional context to include in error reports
        capture_exceptions: Whether to capture exceptions to Sentry
        reraise: Whether to reraise exceptions after handling
    """
    try:
        yield
    except Exception as exc:
        if capture_exceptions:
            category = ErrorHandler.categorize_error(exc)
            scope = ErrorHandler.create_enhanced_scope(exc, category, context)
            
            # Log the error locally
            logger.error(
                "Enhanced error handling caught exception",
                extra={
                    "exception_type": type(exc).__name__,
                    "exception_message": str(exc),
                    "error_category": category,
                    "context": context or {}
                },
                exc_info=True
            )
            
            # Capture to Sentry
            capture_exception(exc, scope=scope)
        
        if reraise:
            raise


def handle_api_error(
    exc: Exception,
    request: Any = None,
    handler_context: Mapping[str, Any] | None = None,
    status_code: int = 500
) -> Response:
    """
    Handle API errors with enhanced error reporting.
    
    Args:
        exc: The exception to handle
        request: The request object (if available)
        handler_context: Additional context for error reporting
        status_code: HTTP status code for the response
        
    Returns:
        Response object with error details
    """
    category = ErrorHandler.categorize_error(exc)
    
    # Create context from request if available
    context = {}
    if request:
        context.update({
            "endpoint": f"{request.method} {request.path}",
            "user_agent": getattr(request, 'META', {}).get("HTTP_USER_AGENT", "unknown"),
            "request_method": request.method,
            "request_path": request.path
        })
    
    # Create enhanced scope and capture exception
    scope = ErrorHandler.create_enhanced_scope(
        exc, category, context, handler_context
    )
    
    # Add request-specific context to scope
    if request:
        scope.set_extra("request_data", getattr(request, 'data', None))
        scope.set_extra("request_user", getattr(request, 'user', None))
    
    event_id = capture_exception(exc, scope=scope)
    
    # Get user-friendly error message
    error_message = ErrorHandler.get_user_friendly_error_message(exc, category)
    
    # Create response body
    response_body = {
        "detail": error_message,
        "errorId": event_id,
        "errorCategory": category
    }
    
    # Add debug information in development
    if settings.DEBUG:
        response_body["debug"] = {
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc()
        }
    
    return Response(response_body, status=status_code)


def log_error_with_context(
    exc: Exception,
    message: str,
    context: dict[str, Any] | None = None,
    level: int = logging.ERROR
) -> None:
    """
    Log an error with additional context information.
    
    Args:
        exc: The exception to log
        message: Log message
        context: Additional context to include
        level: Log level
    """
    category = ErrorHandler.categorize_error(exc)
    
    log_context = {
        "exception_type": type(exc).__name__,
        "exception_message": str(exc),
        "error_category": category
    }
    
    if context:
        log_context.update(context)
    
    logger.log(level, message, extra=log_context, exc_info=True)


# Decorator for automatic error handling
def with_enhanced_error_handling(capture_exceptions: bool = True, reraise: bool = True):
    """
    Decorator to add enhanced error handling to functions.
    
    Args:
        capture_exceptions: Whether to capture exceptions to Sentry
        reraise: Whether to reraise exceptions after handling
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            context = {
                "function": func.__name__,
                "module": func.__module__
            }
            
            with enhanced_error_handling(
                context=context,
                capture_exceptions=capture_exceptions,
                reraise=reraise
            ):
                return func(*args, **kwargs)
        
        return wrapper
    return decorator