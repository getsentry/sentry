"""Example usage of the Recruiter CRM API."""
import asyncio
from fastapi import FastAPI
from api.routes.recruiter_crm import router
from middleware.logging import LoggingMiddleware
from middleware.security import SecurityHeadersMiddleware, RateLimitMiddleware


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.
    
    Returns:
        Configured FastAPI application
    """
    # Create app
    app = FastAPI(
        title="Recruiter CRM API",
        description="API for managing recruiter relationships and data",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # Add middleware (order matters - applied in reverse)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_minute=60,
        requests_per_hour=1000,
        whitelist_ips=("127.0.0.1", "localhost", "testclient")
    )
    
    # Include routers
    app.include_router(router)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "service": "recruiter-crm"}
    
    return app


# Create app instance
app = create_app()


# Example usage
if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("Starting Recruiter CRM API Server")
    print("=" * 60)
    print("\nAPI Documentation available at:")
    print("  - Swagger UI: http://localhost:8000/docs")
    print("  - ReDoc: http://localhost:8000/redoc")
    print("\nExample endpoints:")
    print("  - GET  /api/v1/recruiter-crm/recruiters")
    print("  - GET  /api/v1/recruiter-crm/recruiters/{id}")
    print("  - POST /api/v1/recruiter-crm/recruiters")
    print("  - PUT  /api/v1/recruiter-crm/recruiters/{id}")
    print("  - DELETE /api/v1/recruiter-crm/recruiters/{id}")
    print("\nHealth check:")
    print("  - GET  /health")
    print("\n" + "=" * 60 + "\n")
    
    # Run the server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
