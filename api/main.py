"""
Main FastAPI application demonstrating correct route ordering.

This file shows how to properly include the jobs router in a FastAPI app.
"""
from fastapi import FastAPI
from api.routes.jobs import router as jobs_router

app = FastAPI(
    title="Job Board API",
    description="API for managing job postings with correct route ordering",
    version="1.0.0"
)

# Include the jobs router
app.include_router(jobs_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
