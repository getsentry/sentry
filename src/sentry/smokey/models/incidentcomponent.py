from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import DefaultFieldsModel, region_silo_model


@region_silo_model
class IncidentCaseComponent(DefaultFieldsModel):
    """
    Represents a component or service that can be associated with an incident case.
    """

    __relocation_scope__ = RelocationScope.Global

    case = FlexibleForeignKey("sentry.IncidentCase")
    component = FlexibleForeignKey("sentry.IncidentComponent")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentcasecomponent"
        unique_together = (("case", "component"),)


@region_silo_model
class IncidentComponent(DefaultFieldsModel):
    """
    Represents a component or service that can be associated with an incident.
    """

    __relocation_scope__ = RelocationScope.Global

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    # E.g. The ID provided by this linked component on the associated status page provider.
    status_page_component_id = models.CharField(max_length=255, null=True, blank=True)

    parent_component = FlexibleForeignKey("sentry.IncidentComponent", null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentcomponent"
        unique_together = (("organization", "name"),)
