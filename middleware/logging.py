"""Logging middleware for the application."""
import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.middleware.base import RequestResponseEndpoint


# Configure logger
logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log HTTP requests and responses."""
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process and log request/response."""
        # Generate unique request ID
        request_id = uuid.uuid4().hex[:8]
        
        # Extract request info
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Start timer
        start_time = time.time()
        
        # Log data
        log_data = {
            "request_id": request_id,
            "method": method,
            "path": path,
            "client_ip": client_ip,
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
            log_data.update({
                "status_code": response.status_code,
                "duration_ms": duration_ms
            })
            logger.info(
                f"[{request_id}] ← {response.status_code} ({duration_ms}ms)",
                extra=log_data
            )

            return response
        except Exception as exc:
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)

            # Log error
            log_data.update({
                "status_code": 500,
                "duration_ms": duration_ms,
                "error": str(exc)
            })
            logger.error(
                f"[{request_id}] ← ERROR ({duration_ms}ms): {str(exc)}",
                extra=log_data
            )

            # Re-raise exception to be handled by error handlers
            raise
