"""Email Monitoring Configuration Model."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class EmailMonitoringConfig(Base):
    """Model for email monitoring configuration."""

    __tablename__ = "email_monitoring_configs"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    user_id = Column(PostgreSQLUUID(as_uuid=True), nullable=False, index=True)
    email_provider = Column(String(50), nullable=False)
    email_address = Column(String(255), nullable=False)
    encrypted_password = Column(Text)
    oauth_token = Column(Text)
    oauth_refresh_token = Column(Text)
    oauth_expiry = Column(DateTime)
    imap_server = Column(String(255))
    imap_port = Column(Integer)
    folders_to_monitor = Column(Text)
    monitoring_enabled = Column(Boolean, default=True, nullable=False)
    sync_frequency_minutes = Column(Integer, default=15)
    last_sync_at = Column(DateTime)
    last_sync_status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<EmailMonitoringConfig(id={self.id}, user_id={self.user_id}, email={self.email_address})>"
