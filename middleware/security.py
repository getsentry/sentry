"""Security middleware for the application."""
import time
from typing import Dict, Optional
from collections import defaultdict, deque
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.middleware.base import RequestResponseEndpoint


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to responses."""
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request and add security headers to response."""
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Strict Transport Security (HTTPS only)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to implement rate limiting."""
    
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60, whitelist_ips: Optional[list] = None):
        """
        Initialize rate limiting middleware.
        
        Args:
            app: The FastAPI application
            max_requests: Maximum number of requests allowed in the time window
            window_seconds: Time window in seconds
            whitelist_ips: List of IP addresses to whitelist from rate limiting
        """
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.whitelist_ips = set(whitelist_ips or ["testclient"])
        self.request_log: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_requests))
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        if request.client:
            return request.client.host
        return "unknown"
    
    def _cleanup_old_entries(self, current_time: float):
        """Remove old entries from the request log."""
        # This is a simple implementation - in production, use Redis or similar
        pass
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with rate limiting."""
        current_time = time.time()
        self._cleanup_old_entries(current_time)

        # Skip rate limiting for whitelisted IPs
        client_ip = self._get_client_ip(request)
        if client_ip in self.whitelist_ips:
            return await call_next(request)

        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        # Check rate limit
        requests = self.request_log[client_ip]
        
        # Remove old requests outside the time window
        while requests and requests[0] < current_time - self.window_seconds:
            requests.popleft()
        
        if len(requests) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
        
        # Add current request
        requests.append(current_time)
        
        response = await call_next(request)
        return response
