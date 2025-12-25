"""Main FastAPI application for Recruiter CRM."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.recruiter_crm import router as recruiter_router


app = FastAPI(
    title="Recruiter CRM API",
    description="API for managing recruiter contacts and relationships",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(recruiter_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Recruiter CRM API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
