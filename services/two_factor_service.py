"""
Two-Factor Authentication Service.
"""
from typing import List, Optional, Union
from uuid import UUID
from datetime import datetime


class AuthLog:
    """Authentication log entry."""
    
    def __init__(
        self,
        user_id: Union[str, UUID],
        event_type: Optional[str] = None,
        timestamp: Optional[datetime] = None,
        suspicious: bool = False,
    ):
        self.user_id = user_id
        self.event_type = event_type
        self.timestamp = timestamp or datetime.now()
        self.suspicious = suspicious


class TwoFactorService:
    """Service for managing two-factor authentication."""
    
    def get_auth_logs(
        self,
        user_id: Union[str, UUID],
        event_type: Optional[str] = None,
        suspicious_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AuthLog]:
        """
        Get authentication logs for a user.
        
        This method accepts both UUID and string user IDs to support
        various authentication systems (standard UUIDs, legacy IDs, test users, etc.)
        
        Args:
            user_id: User ID (can be UUID or string)
            event_type: Filter by event type
            suspicious_only: Return only suspicious events
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of authentication logs
        """
        # Convert UUID to string for consistent handling
        user_id_str = str(user_id)
        
        # In a real implementation, this would query a database
        # For now, return an empty list to demonstrate the interface
        logs = []
        
        # Example: Filter by event type and suspicious flag
        # logs = db.query(AuthLog).filter(
        #     AuthLog.user_id == user_id_str,
        #     AuthLog.event_type == event_type if event_type else True,
        #     AuthLog.suspicious == True if suspicious_only else True
        # ).offset(offset).limit(limit).all()
        
        return logs
