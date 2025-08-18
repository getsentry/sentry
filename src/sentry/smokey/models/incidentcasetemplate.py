from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import DefaultFieldsModel, region_silo_model


@region_silo_model
class IncidentCaseTemplate(DefaultFieldsModel):
    """
    The customizable template that organizations can specify to modify how their
    incidents are handled, displayed and tracked.
    """

    __relocation_scope__ = RelocationScope.Global

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=255)

    case_handle = models.CharField(default="INC", max_length=8)
    severity_handle = models.CharField(default="SEV", max_length=8)
    severity_labels = models.JSONField(default=list)
    case_lead_title = models.CharField(default="Commander", max_length=255)
    update_frequency_minutes = models.IntegerField(default=15, null=True, blank=True)

    # Where the on-call schedule is stored.
    schedule_provider = models.CharField(
        choices=[
            ("sentry", "Sentry"),
            ("pagerduty", "PagerDuty"),
        ],
        null=True,
        blank=True,
    )
    schedule_config = models.JSONField(default=dict, null=True, blank=True)

    # Where the incident tasks are stored
    task_provider = models.CharField(
        choices=[
            ("sentry", "Sentry"),
            ("jira", "Jira"),
            ("linear", "Linear"),
        ],
        null=True,
        blank=True,
    )
    task_config = models.JSONField(default=dict, null=True, blank=True)

    # Where conversations take place.
    channel_provider = models.CharField(
        choices=[
            ("slack", "Slack"),
            ("discord", "Discord"),
            ("teams", "Microsoft Teams"),
        ],
        null=True,
        blank=True,
    )
    channel_config = models.JSONField(default=dict, null=True, blank=True)

    # Where the updates are published to users.
    status_page_provider = models.CharField(
        choices=[
            ("sentry", "Sentry"),
            ("statuspage", "Statuspage"),
        ],
        null=True,
        blank=True,
    )
    status_page_config = models.JSONField(default=dict, null=True, blank=True)

    # Where the learnings are handled.
    retro_provider = models.CharField(
        choices=[
            ("sentry", "Sentry"),
            ("notion", "Notion"),
            ("google-docs", "Google Docs"),
            ("confluence", "Confluence"),
        ],
        null=True,
        blank=True,
    )
    retro_config = models.JSONField(default=dict, null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentcasetemplate"
        unique_together = (("organization_id", "name"),)
