"""Logging middleware for request/response logging."""
import time
import logging
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""
    
    async def dispatch(self, request: Request, call_next):
        """
        Log incoming requests and outgoing responses.
        
        Args:
            request: The incoming HTTP request
            call_next: The next middleware or endpoint to call
            
        Returns:
            The HTTP response
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
            
            # Update log data with response info
            log_data.update({
                "status_code": response.status_code,
                "duration_ms": duration_ms
            })
            
            # Log response
            logger.info(
                f"[{request_id}] ← {response.status_code} ({duration_ms}ms)",
                extra=log_data
            )
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)
            
            # Update log data with error info
            log_data.update({
                "status_code": 500,
                "duration_ms": duration_ms,
                "error": str(e)
            })
            
            # Log error
            logger.error(
                f"[{request_id}] ← ERROR ({duration_ms}ms): {str(e)}",
                extra=log_data,
                exc_info=True
            )
            
            # Re-raise the exception
            raise
