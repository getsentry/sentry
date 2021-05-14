import logging

from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, DefaultFieldsModel, FlexibleForeignKey
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger(__name__)


class ExternalActor(DefaultFieldsModel):
    __core__ = False

    actor = FlexibleForeignKey("sentry.Actor", db_index=True, on_delete=models.CASCADE)
    organization = FlexibleForeignKey("sentry.Organization")
    integration = FlexibleForeignKey("sentry.Integration")
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
            (ExternalProviders.MSTEAMS, "msteams"),
            (ExternalProviders.PAGERDUTY, "pagerduty"),
            (ExternalProviders.GITHUB, "github"),
            (ExternalProviders.GITLAB, "gitlab"),
            (ExternalProviders.CUSTOM, "custom_scm"),
        ),
    )

    # external name => display name i.e. username, team name, channel name
    # external id => unique identifier i.e user id, channel id
    external_name = models.TextField()
    external_id = models.TextField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalactor"
        unique_together = (("organization", "provider", "external_name", "actor"),)
