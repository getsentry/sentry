"""Main FastAPI application for Recruiter CRM."""
from fastapi import FastAPI
from api.routes import recruiter_crm
from middleware.security import SecurityHeadersMiddleware, RateLimitMiddleware
from middleware.logging import RequestLoggingMiddleware


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Recruiter CRM API",
        description="API for managing recruiter relationships and follow-ups",
        version="1.0.0"
    )

    # Add middleware (order matters - they execute in reverse order)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)
    app.add_middleware(RequestLoggingMiddleware)

    # Include routers
    app.include_router(recruiter_crm.router)

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy"}

    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
