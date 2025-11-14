from typing import int
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class DataForwarder(DefaultFieldsModel):
    """
    Configuration for data forwarding to external services (Segment, SQS, or Splunk).
    This is a general config that can apply to specific projects or all projects in an organization.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    is_enabled = models.BooleanField(default=True)

    enroll_new_projects = models.BooleanField(default=False)
    enrolled_projects = models.ManyToManyField(
        "sentry.Project", through="sentry.DataForwarderProject", related_name="data_forwarders"
    )

    provider = models.CharField(
        max_length=64,
        choices=[
            ("segment", "Segment"),
            ("sqs", "Amazon SQS"),
            ("splunk", "Splunk"),
        ],
    )
    config = models.JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dataforwarder"
        unique_together = (("organization", "provider"),)
