"""Security middleware for rate limiting and security headers."""
import time
from collections import defaultdict
from typing import Dict, Set, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.types import RequestResponseEndpoint


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware for adding security headers to responses."""
    
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
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'"
        )
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=()"
        )
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting requests."""
    
    def __init__(
        self,
        app,
        max_requests: int = 100,
        window_seconds: int = 60,
        whitelist_ips: Set[str] = None
    ):
        """
        Initialize rate limiter.
        
        Args:
            app: The FastAPI application
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds
            whitelist_ips: Set of IP addresses to whitelist
        """
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.whitelist_ips = whitelist_ips or {"testclient", "127.0.0.1", "::1"}
        
        # Track requests: {ip: [(timestamp, count), ...]}
        self.request_history: Dict[str, list[Tuple[float, int]]] = defaultdict(list)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check for forwarded IP (when behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to client host
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _cleanup_old_entries(self, current_time: float):
        """Remove entries older than the time window."""
        cutoff_time = current_time - self.window_seconds
        
        for ip in list(self.request_history.keys()):
            # Filter out old entries
            self.request_history[ip] = [
                (ts, count) for ts, count in self.request_history[ip]
                if ts > cutoff_time
            ]
            
            # Remove empty entries
            if not self.request_history[ip]:
                del self.request_history[ip]
    
    def _get_request_count(self, client_ip: str, current_time: float) -> int:
        """Get total request count for an IP in the current window."""
        return sum(
            count for ts, count in self.request_history[client_ip]
            if ts > current_time - self.window_seconds
        )
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Check rate limits and process request."""
        current_time = time.time()
        
        # Cleanup old entries periodically
        self._cleanup_old_entries(current_time)
        
        # Skip rate limiting for whitelisted IPs
        client_ip = self._get_client_ip(request)
        if client_ip in self.whitelist_ips:
            return await call_next(request)
        
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Check rate limit
        request_count = self._get_request_count(client_ip, current_time)
        
        if request_count >= self.max_requests:
            # Rate limit exceeded
            retry_after = self.window_seconds
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Please try again in {retry_after} seconds.",
                    "retry_after": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(current_time + retry_after))
                }
            )
        
        # Record this request
        self.request_history[client_ip].append((current_time, 1))
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = self.max_requests - request_count - 1
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(
            int(current_time + self.window_seconds)
        )
        
        return response
