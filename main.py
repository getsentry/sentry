"""Main FastAPI application for salary database API."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from api.routes import salary_database
from middleware.logging import LoggingMiddleware
from middleware.security import SecurityHeadersMiddleware, RateLimitMiddleware


# Create FastAPI app
app = FastAPI(
    title="Salary Database API",
    description="API for accessing company salary information",
    version="1.0.0"
)


# Add middleware (order matters - last added is executed first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    max_requests=100,
    window_seconds=60
)
app.add_middleware(LoggingMiddleware)


# Include routers
app.include_router(salary_database.router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Salary Database API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "companies": "/api/v1/salary-database/companies",
            "company_profile": "/api/v1/salary-database/company/{company_name}",
            "company_statistics": "/api/v1/salary-database/company/{company_name}/statistics",
            "documentation": "/docs",
            "openapi_schema": "/openapi.json"
        }
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "path": str(request.url)
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    print("Starting Salary Database API...")
    print("Docs available at: http://localhost:8000/docs")
    print()
    print("Example endpoints:")
    print("  - GET http://localhost:8000/api/v1/salary-database/company/google")
    print("  - GET http://localhost:8000/api/v1/salary-database/company/google?role=engineer&level=senior")
    print("  - GET http://localhost:8000/api/v1/salary-database/company/google/statistics")
    print()
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
