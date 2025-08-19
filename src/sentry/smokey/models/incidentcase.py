from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.smokey.models.incidentcomponent import IncidentCaseComponent


@region_silo_model
class IncidentCase(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Global

    organization = FlexibleForeignKey("sentry.Organization")
    template = FlexibleForeignKey("sentry.IncidentCaseTemplate")
    case_lead = FlexibleForeignKey("sentry.OrganizationMember")
    affected_components = models.ManyToManyField(
        "sentry.IncidentComponent",
        through=IncidentCaseComponent,
        blank=True,
    )

    title = models.CharField(max_length=255)
    description = models.TextField()
    summary = models.TextField()
    status = models.CharField(max_length=255)
    severity = models.PositiveSmallIntegerField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)

    # The instances of linked services that are associated with the case
    schedule_record = models.JSONField(default=dict, null=True, blank=True)
    task_record = models.JSONField(default=dict, null=True, blank=True)
    channel_record = models.JSONField(default=dict, null=True, blank=True)
    status_page_record = models.JSONField(default=dict, null=True, blank=True)
    retro_record = models.JSONField(default=dict, null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentcase"
