"""Email Status Update Model."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from api.models.email_monitoring_config import Base


class EmailStatusUpdate(Base):
    """Model for email status updates extracted from ATS emails."""

    __tablename__ = "email_status_updates"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    email_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("monitored_emails.id"), nullable=False, index=True)
    application_id = Column(String(255))
    company_name = Column(String(255))
    job_title = Column(String(255))
    status = Column(String(100))
    status_category = Column(String(50))
    auto_applied = Column(Boolean, default=False)
    requires_review = Column(Boolean, default=True)
    review_reason = Column(Text)
    user_feedback = Column(String(50))
    feedback_comment = Column(Text)
    extracted_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship to email
    email = relationship("MonitoredEmail", backref="status_updates")

    def __repr__(self):
        return f"<EmailStatusUpdate(id={self.id}, company={self.company_name}, status={self.status})>"
