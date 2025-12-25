"""
FastAPI application for jobs API
"""
from fastapi import FastAPI
from api.routes.jobs import router as jobs_router

app = FastAPI(
    title="Jobs API",
    description="API for job search and management",
    version="1.0.0"
)

# Include routers
app.include_router(jobs_router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "jobs-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
