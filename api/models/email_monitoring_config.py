"""
Email Monitoring Configuration Model

Database model for storing email monitoring configurations.
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    DateTime,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.declarative import declarative_base


Base = declarative_base()


class EmailMonitoringConfig(Base):
    """
    Email monitoring configuration model.
    
    This model stores user email monitoring settings including provider details,
    authentication credentials, and monitoring preferences.
    """
    
    __tablename__ = "email_monitoring_configs"
    
    # Primary key
    id = Column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False
    )
    
    # User association - IMPORTANT: as_uuid=True expects UUID objects, not strings
    user_id = Column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True
    )
    
    # Email configuration
    email_provider = Column(String(50), nullable=True)
    email_address = Column(String(255), nullable=False)
    
    # Authentication (encrypted/hashed in practice)
    encrypted_password = Column(Text, nullable=True)
    oauth_token = Column(Text, nullable=True)
    oauth_refresh_token = Column(Text, nullable=True)
    oauth_expiry = Column(DateTime, nullable=True)
    
    # IMAP configuration
    imap_server = Column(String(255), nullable=True)
    imap_port = Column(Integer, nullable=True)
    
    # Monitoring settings
    folders_to_monitor = Column(Text, nullable=True)  # JSON or comma-separated
    monitoring_enabled = Column(Boolean, default=True, nullable=False)
    sync_frequency_minutes = Column(Integer, default=15, nullable=True)
    
    # Sync status
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(50), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    
    def __repr__(self) -> str:
        return (
            f"<EmailMonitoringConfig("
            f"id={self.id}, "
            f"user_id={self.user_id}, "
            f"email={self.email_address}"
            f")>"
        )
