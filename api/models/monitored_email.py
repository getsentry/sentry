"""Monitored Email Model."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from api.models.email_monitoring_config import Base


class MonitoredEmail(Base):
    """Model for monitored emails."""

    __tablename__ = "monitored_emails"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    config_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("email_monitoring_configs.id"), nullable=False, index=True)
    message_id = Column(String(255), nullable=False, unique=True)
    subject = Column(Text)
    sender = Column(String(255))
    recipient = Column(String(255))
    received_date = Column(DateTime)
    is_ats_email = Column(Boolean, default=False)
    classification = Column(String(100))
    confidence_score = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship to config
    config = relationship("EmailMonitoringConfig", backref="monitored_emails")

    def __repr__(self):
        return f"<MonitoredEmail(id={self.id}, subject={self.subject}, is_ats={self.is_ats_email})>"
