"""
FastAPI Jobs API Application - Fixed Implementation

This application demonstrates the fix for the issue where an unimplemented
endpoint (/api/v1/jobs/{job_id}) was raising a 501 HTTPException that wasn't
being handled properly, causing cascading 500 errors.

Key fixes implemented:
1. The /jobs/{job_id} endpoint now has a full implementation instead of
   raising a 501 "Not Implemented" error.
2. Global exception handlers catch any HTTPExceptions and return appropriate
   error responses.
3. Application-level error middleware ensures that internal service calls
   handle exceptions gracefully.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from api.routes import jobs
import logging


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(request_id)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Create FastAPI application
app = FastAPI(
    title="Jobs API",
    description="Job search and management API with proper error handling",
    version="1.0.0"
)


# Include routers
app.include_router(jobs.router)


# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Handle HTTPExceptions globally to prevent unhandled errors.
    
    This ensures that even if an endpoint raises an HTTPException (like 501),
    it will be caught and returned as a proper JSON response instead of
    propagating as an unhandled exception.
    """
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    logger.warning(
        f"HTTP Exception: {exc.status_code} - {exc.detail}",
        extra={'request_id': request_id, 'path': request.url.path}
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id,
            "path": str(request.url.path)
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle request validation errors.
    """
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": exc.errors(),
            "request_id": request_id
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unexpected exceptions.
    
    This prevents any unhandled exceptions from causing 500 errors
    without proper error responses.
    """
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    logger.error(
        f"Unhandled exception: {str(exc)}",
        extra={'request_id': request_id, 'path': request.url.path},
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": request_id,
            "path": str(request.url.path)
        }
    )


# Middleware for request tracking
@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    """
    Add a request ID to each request for tracking.
    """
    import uuid
    
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    
    logger.info(
        f"→ {request.method} {request.url.path}",
        extra={
            'request_id': request_id,
            'method': request.method,
            'path': request.url.path,
            'query': str(request.url.query) if request.url.query else None
        }
    )
    
    try:
        response = await call_next(request)
        
        logger.info(
            f"← {response.status_code}",
            extra={
                'request_id': request_id,
                'status_code': response.status_code,
            }
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as exc:
        logger.error(
            f"Request failed: {str(exc)}",
            extra={'request_id': request_id},
            exc_info=True
        )
        raise


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "jobs-api",
        "version": "1.0.0"
    }


# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint with API information.
    """
    return {
        "message": "Jobs API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "jobs_search": "/api/v1/jobs/search",
            "job_detail": "/api/v1/jobs/{job_id}",
            "docs": "/docs"
        }
    }
