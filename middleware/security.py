"""Security middleware for HTTP headers and rate limiting."""
import time
from collections import defaultdict
from typing import Callable, Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses."""

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """Process request and add security headers to response."""
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Strict transport security (HTTPS only)
        # Uncomment in production with HTTPS
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Content Security Policy
        response.headers["Content-Security-Policy"] = "default-src 'self'"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting API requests."""

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        whitelist_ips: Tuple[str, ...] = ("127.0.0.1", "localhost", "testclient")
    ):
        """Initialize rate limiting middleware.
        
        Args:
            app: The ASGI application
            requests_per_minute: Maximum requests allowed per minute per IP
            requests_per_hour: Maximum requests allowed per hour per IP
            whitelist_ips: IPs that bypass rate limiting
        """
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.whitelist_ips = whitelist_ips
        
        # Store request timestamps: {ip: [(timestamp, window_type), ...]}
        self.request_history: Dict[str, list] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request.
        
        Args:
            request: The incoming HTTP request
            
        Returns:
            Client IP address
        """
        # Check for forwarded IP first (if behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        # Fall back to direct client IP
        if request.client:
            return request.client.host
        
        return "unknown"

    def _cleanup_old_entries(self, current_time: float):
        """Remove old entries to prevent memory bloat.
        
        Args:
            current_time: Current timestamp
        """
        # Remove entries older than 1 hour
        cutoff_time = current_time - 3600
        
        for ip in list(self.request_history.keys()):
            self.request_history[ip] = [
                entry for entry in self.request_history[ip]
                if entry[0] > cutoff_time
            ]
            
            # Remove IP if no recent requests
            if not self.request_history[ip]:
                del self.request_history[ip]

    def _is_rate_limited(self, client_ip: str, current_time: float) -> Tuple[bool, str]:
        """Check if client is rate limited.
        
        Args:
            client_ip: Client IP address
            current_time: Current timestamp
            
        Returns:
            Tuple of (is_limited, reason)
        """
        # Get request history for this IP
        history = self.request_history[client_ip]
        
        # Check minute limit
        minute_ago = current_time - 60
        requests_last_minute = sum(1 for ts, _ in history if ts > minute_ago)
        
        if requests_last_minute >= self.requests_per_minute:
            return True, "Rate limit exceeded: too many requests per minute"
        
        # Check hour limit
        hour_ago = current_time - 3600
        requests_last_hour = sum(1 for ts, _ in history if ts > hour_ago)
        
        if requests_last_hour >= self.requests_per_hour:
            return True, "Rate limit exceeded: too many requests per hour"
        
        return False, ""

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """Process request with rate limiting.
        
        Args:
            request: The incoming HTTP request
            call_next: The next middleware or route handler
            
        Returns:
            HTTP response or rate limit error
        """
        current_time = time.time()
        
        # Periodically cleanup old entries
        self._cleanup_old_entries(current_time)

        # Skip rate limiting for whitelisted IPs
        client_ip = self._get_client_ip(request)
        if client_ip in self.whitelist_ips:
            return await call_next(request)

        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        # Check if rate limited
        is_limited, reason = self._is_rate_limited(client_ip, current_time)
        
        if is_limited:
            return JSONResponse(
                status_code=429,
                content={"detail": reason},
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit-Minute": str(self.requests_per_minute),
                    "X-RateLimit-Limit-Hour": str(self.requests_per_hour),
                }
            )

        # Record this request
        self.request_history[client_ip].append((current_time, "request"))

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        minute_ago = current_time - 60
        requests_last_minute = sum(
            1 for ts, _ in self.request_history[client_ip] if ts > minute_ago
        )
        
        response.headers["X-RateLimit-Limit-Minute"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining-Minute"] = str(
            max(0, self.requests_per_minute - requests_last_minute)
        )

        return response
