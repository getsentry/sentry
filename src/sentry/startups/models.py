from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class ApplicationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    NEEDS_INFO = "needs_info", "Needs Info"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    DUPLICATE = "duplicate", "Duplicate"


class RejectionReason(models.TextChoices):
    TOO_MUCH_FUNDING = "too_much_funding", "Too Much Funding"
    ALREADY_PAYING = "already_paying", "Already Paying"
    BAD_ORG = "bad_org", "Bad Org"
    DUPLICATE = "duplicate", "Duplicate"
    OTHER = "other", "Other"


@cell_silo_model
class StartupApplication(Model):
    """
    Represents a startup program application submitted by an org.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", db_constraint=False)
    submitted_by_id = HybridCloudForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL"
    )

    # Form fields (match the existing sentry.io/for/startups/apply form)
    startup_name = models.CharField(max_length=255)
    startup_website = models.URLField(max_length=500)
    org_slug = models.CharField(max_length=255)
    founders_name = models.CharField(max_length=500)
    contact_email = models.EmailField()
    founding_date_text = models.CharField(max_length=100)
    funding_details = models.TextField()

    # Status
    status = models.CharField(
        max_length=20,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.PENDING,
        db_index=True,
    )

    # Auto-flags (computed on submission)
    flag_possible_duplicate = models.BooleanField(default=False)
    flag_company_age = models.BooleanField(default=False)

    # Reviewer fields
    reviewer_id = HybridCloudForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete="SET_NULL",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(
        max_length=30,
        choices=RejectionReason.choices,
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True, default="")

    # Credits
    credits_applied_at = models.DateTimeField(null=True, blank=True)
    credits_amount = models.IntegerField(null=True, blank=True)
    credits_tag = models.CharField(max_length=100, null=True, blank=True)

    # Timestamps
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_startupapplication"
        indexes = [
            models.Index(fields=["status", "date_added"]),
            models.Index(fields=["org_slug"]),
            models.Index(fields=["organization", "status"]),
        ]

    __repr__ = sane_repr("startup_name", "org_slug", "status")


@cell_silo_model
class StartupApplicationEmail(Model):
    """
    Audit log of emails sent for a startup application.
    """

    __relocation_scope__ = RelocationScope.Excluded

    application = FlexibleForeignKey(
        "sentry.StartupApplication",
        related_name="emails",
        db_constraint=False,
    )
    template_name = models.CharField(max_length=100)
    subject = models.TextField()
    body = models.TextField()
    sent_by_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_startupapplicationemail"

    __repr__ = sane_repr("application_id", "template_name")


@cell_silo_model
class StartupEmailTemplate(Model):
    """
    Email templates for startup program communications.
    Templates support merge variables: {{name}}, {{company}}, {{slug}}, {{amount}}.
    """

    __relocation_scope__ = RelocationScope.Excluded

    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=255)
    subject = models.TextField()
    body = models.TextField()
    rejection_reason = models.CharField(
        max_length=30,
        choices=RejectionReason.choices,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_startupemailtemplate"

    __repr__ = sane_repr("name", "display_name")
