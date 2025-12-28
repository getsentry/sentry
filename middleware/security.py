"""Security middleware for headers and rate limiting."""
import time
from collections import defaultdict
from typing import Dict, Set, Tuple

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


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
        
        # Enforce HTTPS
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to implement rate limiting."""

    def __init__(self, app, whitelist_ips: Set[str] = None):
        """
        Initialize rate limiter.
        
        Args:
            app: FastAPI application
            whitelist_ips: Set of IPs to exclude from rate limiting
        """
        super().__init__(app)
        self.whitelist_ips = whitelist_ips or {"127.0.0.1", "testclient"}
        self.request_counts: Dict[str, list] = defaultdict(list)
        self.last_cleanup = time.time()
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        if request.client:
            return request.client.host
        
        # Check for forwarded headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        return "unknown"
    
    def _cleanup_old_entries(self, current_time: float):
        """Remove old entries from request counts."""
        # Only cleanup every minute
        if current_time - self.last_cleanup < 60:
            return
        
        self.last_cleanup = current_time
        cutoff_time = current_time - 60  # Keep last minute
        
        for ip in list(self.request_counts.keys()):
            self.request_counts[ip] = [
                timestamp for timestamp in self.request_counts[ip]
                if timestamp > cutoff_time
            ]
            
            # Remove empty entries
            if not self.request_counts[ip]:
                del self.request_counts[ip]

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with rate limiting."""
        current_time = time.time()
        
        # Cleanup old entries
        self._cleanup_old_entries(current_time)
        
        # Skip rate limiting for whitelisted IPs
        client_ip = self._get_client_ip(request)
        if client_ip in self.whitelist_ips:
            return await call_next(request)
        
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Check rate limit (example: 100 requests per minute)
        self.request_counts[client_ip].append(current_time)
        
        # Count requests in last minute
        cutoff_time = current_time - 60
        recent_requests = [
            t for t in self.request_counts[client_ip]
            if t > cutoff_time
        ]
        
        if len(recent_requests) > 100:
            from starlette.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
        
        return await call_next(request)
