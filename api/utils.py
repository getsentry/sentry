"""Utility functions for UUID handling.

This module provides helper functions to ensure proper UUID type handling
throughout the application, preventing AttributeError when using SQLAlchemy
UUID columns.
"""
import uuid
from typing import Optional, Union
from uuid import UUID


def ensure_uuid(value: Union[str, UUID, None]) -> Optional[UUID]:
    """
    Ensure value is a UUID object, converting from string if necessary.
    
    This function is critical for preventing SQLAlchemy UUID binding errors.
    SQLAlchemy's UUID type expects uuid.UUID objects, not strings.
    
    Args:
        value: A UUID string, UUID object, or None
        
    Returns:
        UUID object or None
        
    Raises:
        ValueError: If string is not a valid UUID format
        
    Examples:
        >>> ensure_uuid("00000000-0000-0000-0000-000000000001")
        UUID('00000000-0000-0000-0000-000000000001')
        
        >>> ensure_uuid(uuid.UUID("00000000-0000-0000-0000-000000000001"))
        UUID('00000000-0000-0000-0000-000000000001')
        
        >>> ensure_uuid(None)
        None
    """
    if value is None:
        return None
    
    if isinstance(value, str):
        try:
            return uuid.UUID(value)
        except ValueError as e:
            raise ValueError(f"Invalid UUID string: {value}") from e
    
    if isinstance(value, UUID):
        return value
    
    raise TypeError(f"Expected str, UUID, or None, got {type(value).__name__}")


def uuid_to_str(value: Union[str, UUID, None]) -> Optional[str]:
    """
    Convert UUID to string representation.
    
    Useful for JSON serialization and logging.
    
    Args:
        value: A UUID object, string, or None
        
    Returns:
        String representation of UUID or None
        
    Examples:
        >>> uuid_to_str(uuid.UUID("00000000-0000-0000-0000-000000000001"))
        '00000000-0000-0000-0000-000000000001'
        
        >>> uuid_to_str("00000000-0000-0000-0000-000000000001")
        '00000000-0000-0000-0000-000000000001'
        
        >>> uuid_to_str(None)
        None
    """
    if value is None:
        return None
    
    if isinstance(value, UUID):
        return str(value)
    
    if isinstance(value, str):
        # Validate it's a proper UUID
        try:
            uuid.UUID(value)
            return value
        except ValueError as e:
            raise ValueError(f"Invalid UUID string: {value}") from e
    
    raise TypeError(f"Expected str, UUID, or None, got {type(value).__name__}")


def is_valid_uuid(value: Union[str, UUID, None]) -> bool:
    """
    Check if value is a valid UUID.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a valid UUID or UUID string, False otherwise
        
    Examples:
        >>> is_valid_uuid("00000000-0000-0000-0000-000000000001")
        True
        
        >>> is_valid_uuid("not-a-uuid")
        False
        
        >>> is_valid_uuid(None)
        False
        
        >>> is_valid_uuid(uuid.UUID("00000000-0000-0000-0000-000000000001"))
        True
    """
    if value is None:
        return False
    
    if isinstance(value, UUID):
        return True
    
    if isinstance(value, str):
        try:
            uuid.UUID(value)
            return True
        except (ValueError, AttributeError):
            return False
    
    return False


def generate_uuid() -> UUID:
    """
    Generate a new random UUID.
    
    Returns:
        A new UUID object (version 4)
        
    Example:
        >>> new_id = generate_uuid()
        >>> isinstance(new_id, UUID)
        True
    """
    return uuid.uuid4()


def generate_uuid_str() -> str:
    """
    Generate a new random UUID as a string.
    
    Returns:
        A new UUID string (version 4)
        
    Example:
        >>> new_id = generate_uuid_str()
        >>> is_valid_uuid(new_id)
        True
    """
    return str(uuid.uuid4())


class UUIDConverter:
    """
    Context manager for safely converting UUIDs in database operations.
    
    This class helps ensure all UUID parameters are converted before
    being used in SQLAlchemy queries.
    
    Example:
        >>> with UUIDConverter() as converter:
        ...     user_id = converter.convert(request.user_id)
        ...     config_id = converter.convert(request.config_id)
        ...     query = db.query(Model).filter(
        ...         Model.user_id == user_id,
        ...         Model.config_id == config_id
        ...     )
    """
    
    def __init__(self):
        """Initialize UUID converter."""
        self.conversions = []
    
    def convert(self, value: Union[str, UUID, None]) -> Optional[UUID]:
        """
        Convert value to UUID and track the conversion.
        
        Args:
            value: Value to convert
            
        Returns:
            UUID object or None
        """
        result = ensure_uuid(value)
        self.conversions.append((value, result))
        return result
    
    def __enter__(self):
        """Enter context manager."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager."""
        # Could add logging here if needed
        return False


# Commonly used null UUID
NULL_UUID = uuid.UUID("00000000-0000-0000-0000-000000000000")
NULL_UUID_STR = "00000000-0000-0000-0000-000000000000"
