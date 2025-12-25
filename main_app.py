"""
Complete FastAPI Application Example with Offer Comparison

This demonstrates how to integrate the fixed offer comparison service
into a FastAPI application.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from api.routes.offer_comparison import router as offer_comparison_router
import uvicorn


# Create FastAPI application
app = FastAPI(
    title="Offer Comparison API",
    description="API for comparing job offers",
    version="1.0.0"
)


# Exception handler for better error messages
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all exceptions gracefully"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": str(exc),
            "path": request.url.path
        }
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Offer Comparison API"
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Welcome to Offer Comparison API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "list_offers": "GET /api/v1/offer-comparison/offers",
            "get_offer": "GET /api/v1/offer-comparison/offers/{offer_id}",
            "create_offer": "POST /api/v1/offer-comparison/offers",
            "update_offer": "PUT /api/v1/offer-comparison/offers/{offer_id}",
            "delete_offer": "DELETE /api/v1/offer-comparison/offers/{offer_id}",
            "compare_offers": "POST /api/v1/offer-comparison/offers/compare"
        }
    }


# Include the offer comparison router
app.include_router(offer_comparison_router)


# Startup event
@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    print("="*60)
    print("✓ Offer Comparison API Started Successfully")
    print("="*60)
    print("The AttributeError fix has been applied!")
    print("OfferComparisonService.list_offers() is now available.")
    print("="*60)


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    print("Shutting down Offer Comparison API...")


if __name__ == "__main__":
    # Run the application
    print("\nStarting Offer Comparison API...")
    print("Fixed: AttributeError - 'OfferComparisonService' object has no attribute 'list_offers'")
    print("\nAccess the API at: http://localhost:8000")
    print("Interactive docs at: http://localhost:8000/docs")
    print("\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
