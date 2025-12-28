"""
Example FastAPI application demonstrating the UUID fix.

This shows how to properly integrate the email monitoring routes
with UUID handling into a FastAPI application.
"""
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, Depends, Request
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from api.routes.email_monitoring import router as email_monitoring_router
from api.models.email_monitoring_config import Base
from middleware.logging import LoggingMiddleware
from middleware.security import SecurityHeadersMiddleware, RateLimitMiddleware


# Database setup
DATABASE_URL = "sqlite:///./email_monitoring.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup on shutdown


# Create FastAPI application
app = FastAPI(
    title="Email Monitoring API",
    description="API for monitoring email configurations with proper UUID handling",
    version="1.0.0",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(LoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, whitelist_ips={"127.0.0.1", "testclient"})


# Database dependency
def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Authentication dependency (example implementation)
def get_current_user_id(request: Request) -> UUID:
    """
    Get current user ID from request.
    
    In production, this would validate JWT tokens, sessions, etc.
    For this example, we extract from a header.
    
    IMPORTANT: This now properly returns a UUID object, not a string.
    """
    import uuid
    from api.utils import ensure_uuid
    
    # Get user ID from header (in production, from JWT, session, etc.)
    user_id_str = request.headers.get("X-User-ID", "00000000-0000-0000-0000-000000000001")
    
    # Convert to UUID object - THE FIX
    return ensure_uuid(user_id_str)


# Override the placeholder functions in the router module
import api.routes.email_monitoring as email_monitoring_module
email_monitoring_module.get_db = get_db
email_monitoring_module.get_current_user_id = get_current_user_id


# Include routers
app.include_router(email_monitoring_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Email Monitoring API",
        "status": "operational",
        "uuid_fix": "applied",
        "endpoints": [
            "POST /api/v1/email-monitoring/sync",
            "GET /api/v1/email-monitoring/configs",
            "POST /api/v1/email-monitoring/configure",
            "PATCH /api/v1/email-monitoring/config/{config_id}/toggle",
        ]
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "uuid_handling": "correct"}


# Example usage demonstration
if __name__ == "__main__":
    """
    To run this example:
    
    1. Install dependencies:
       pip install fastapi uvicorn sqlalchemy
    
    2. Run the application:
       uvicorn example_fastapi_app:app --reload
    
    3. Test the endpoint:
       curl -X POST http://localhost:8000/api/v1/email-monitoring/sync \\
            -H "Content-Type: application/json" \\
            -H "X-User-ID: 00000000-0000-0000-0000-000000000001" \\
            -d '{"config_id": null}'
    
    4. The UUID fix ensures that string UUIDs from headers/requests
       are properly converted to UUID objects before SQLAlchemy queries.
    """
    import uvicorn
    
    print("=" * 70)
    print("Email Monitoring API - UUID Fix Applied")
    print("=" * 70)
    print()
    print("The API now properly handles UUID conversion:")
    print("  • String UUIDs from requests → UUID objects")
    print("  • UUID objects used in SQLAlchemy queries")
    print("  • No more AttributeError: 'str' object has no attribute 'hex'")
    print()
    print("Starting server on http://localhost:8000")
    print("API docs available at http://localhost:8000/docs")
    print()
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
