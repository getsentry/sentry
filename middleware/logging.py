"""Logging middleware for request/response logging."""
import time
import uuid
import logging
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """Process and log HTTP request/response.
        
        Args:
            request: The incoming HTTP request
            call_next: The next middleware or route handler
            
        Returns:
            HTTP response
        """
        # Generate unique request ID
        request_id = uuid.uuid4().hex[:8]
        
        # Extract request details
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Start timing
        start_time = time.time()
        
        # Prepare log data
        log_data = {
            "request_id": request_id,
            "client_ip": client_ip,
            "method": method,
            "path": path,
            "user_agent": user_agent,
        }
        
        # Log request
        logger.info(f"[{request_id}] → {method} {path}", extra=log_data)

        # Process request
        try:
            response = await call_next(request)

            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)

            # Log successful response
            log_data.update({
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            })
            
            logger.info(
                f"[{request_id}] ← {response.status_code} ({duration_ms}ms)",
                extra=log_data
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)
            
            # Log error
            log_data.update({
                "status_code": 500,
                "duration_ms": duration_ms,
                "error": str(e),
            })
            
            logger.error(
                f"[{request_id}] ← ERROR ({duration_ms}ms): {str(e)}",
                extra=log_data,
                exc_info=True
            )
            
            # Re-raise the exception to be handled by exception handlers
            raise
