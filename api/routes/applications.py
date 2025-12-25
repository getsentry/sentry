"""
Applications API routes for job application tracking system.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# This would normally be imported from a database module
# For now, creating minimal stubs to fix the NameError issue


class UpdateApplicationRequest(BaseModel):
    """Request model for updating an application."""
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    interview_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    salary_offered: Optional[float] = None


class Application(BaseModel):
    """Application model."""
    id: UUID
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    interview_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    salary_offered: Optional[float] = None
    last_updated: Optional[str] = None


# Mock database session - in real application this would be dependency injected
class DatabaseResult:
    """Mock database result object."""
    def __init__(self, data=None):
        self.data = data


class MockDatabase:
    """Mock database for demonstration purposes."""
    def __init__(self):
        self.applications = {}
    
    def update_application(self, application_id: str, update_data: dict) -> DatabaseResult:
        """Update application in database."""
        # In a real implementation, this would use SQLAlchemy or similar
        if application_id not in self.applications:
            return DatabaseResult(data=None)
        
        self.applications[application_id].update(update_data)
        return DatabaseResult(data=self.applications[application_id])
    
    def get_application(self, application_id: str) -> Optional[dict]:
        """Get application from database."""
        return self.applications.get(application_id)


# Global database instance (in real app, use dependency injection)
db = MockDatabase()

router = APIRouter()


@router.put("/api/v1/applications/{application_id}")
async def update_application(
    application_id: UUID,
    request: UpdateApplicationRequest
) -> Application:
    """
    Update an application by ID.
    
    Args:
        application_id: The UUID of the application to update
        request: The update request containing fields to update
        
    Returns:
        The updated application
        
    Raises:
        HTTPException: 404 if application not found, 500 for other errors
    """
    try:
        # Build update data dictionary from request
        update_data = {
            "last_updated": datetime.utcnow().isoformat()
        }
        
        if request.status:
            update_data["status"] = request.status
            
        if request.priority:
            update_data["priority"] = request.priority
            
        if request.notes:
            update_data["notes"] = request.notes
            
        if request.interview_date:
            update_data["interview_date"] = request.interview_date
            
        if request.follow_up_date:
            update_data["follow_up_date"] = request.follow_up_date
            
        if request.salary_offered:
            update_data["salary_offered"] = request.salary_offered
        
        # Update in Neon/Postgres using SQLAlchemy
        # FIXED: Added the missing database update call that defines 'result'
        result = db.update_application(str(application_id), update_data)
        
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail=f"Application {application_id} not found"
            )
        
        # Convert database result to Application model
        app_data = result.data.copy()
        app_data["id"] = application_id
        
        return Application(**app_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update application: {str(e)}")


@router.get("/api/v1/applications/{application_id}")
async def get_application(application_id: UUID) -> Application:
    """
    Get an application by ID.
    
    Args:
        application_id: The UUID of the application to retrieve
        
    Returns:
        The application
        
    Raises:
        HTTPException: 404 if application not found
    """
    try:
        app_data = db.get_application(str(application_id))
        
        if not app_data:
            raise HTTPException(
                status_code=404,
                detail=f"Application {application_id} not found"
            )
        
        app_data["id"] = application_id
        return Application(**app_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get application: {str(e)}")


@router.post("/api/v1/applications")
async def create_application(request: UpdateApplicationRequest) -> Application:
    """
    Create a new application.
    
    Args:
        request: The application data
        
    Returns:
        The created application
        
    Raises:
        HTTPException: 422 for validation errors, 500 for other errors
    """
    try:
        from uuid import uuid4
        
        application_id = uuid4()
        app_data = {
            "status": request.status,
            "priority": request.priority,
            "notes": request.notes,
            "interview_date": request.interview_date,
            "follow_up_date": request.follow_up_date,
            "salary_offered": request.salary_offered,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        db.applications[str(application_id)] = app_data
        app_data["id"] = application_id
        
        return Application(**app_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create application: {str(e)}")
