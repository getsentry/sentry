"""Logging middleware for request/response logging."""
import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Log request and response details."""
        # Generate request ID
        request_id = uuid.uuid4().hex[:8]
        
        # Extract request details
        method = request.method
        path = request.url.path
        
        # Start timer
        start_time = time.time()
        
        # Log context
        log_data = {
            "request_id": request_id,
            "method": method,
            "path": path,
            "client_ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
        }
        
        # Log request
        logger.info(f"[{request_id}] → {method} {path}", extra=log_data)
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)
            
            # Log response
            logger.info(
                f"[{request_id}] ← {response.status_code} ({duration_ms}ms)",
                extra={**log_data, "status_code": response.status_code, "duration_ms": duration_ms}
            )
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)
            
            # Log error
            logger.error(
                f"[{request_id}] ← ERROR ({duration_ms}ms): {str(e)}",
                extra={**log_data, "duration_ms": duration_ms, "error": str(e)},
                exc_info=True
            )
            raise
