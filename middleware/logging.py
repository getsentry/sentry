"""Logging middleware for FastAPI."""

import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Callable

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """Process request and log details."""
        # Generate request ID
        request_id = uuid.uuid4().hex[:8]
        start_time = time.time()

        # Extract request details
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Prepare log data
        log_data = {
            "request_id": request_id,
            "client_ip": client_ip,
            "method": method,
            "path": path,
            "user_agent": user_agent
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
            logger.info(
                f"[{request_id}] ← {response.status_code} ({duration_ms}ms)",
                extra={
                    **log_data,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms
                }
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            # Calculate duration for error case
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)

            # Log error
            logger.error(
                f"[{request_id}] ← ERROR ({duration_ms}ms): {str(e)}",
                extra={
                    **log_data,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "error": str(e)
                },
                exc_info=True
            )

            # Re-raise the exception to be handled by exception handlers
            raise
