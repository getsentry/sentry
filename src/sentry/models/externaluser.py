import logging

from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, DefaultFieldsModel, FlexibleForeignKey
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger(__name__)


class ExternalTeam(DefaultFieldsModel):
    __core__ = False

    team = FlexibleForeignKey("sentry.Team")
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.UNUSED_GH, "github"),
            (ExternalProviders.UNUSED_GL, "gitlab"),
        ),
    )
    # external_name => the Github/Gitlab team name. Column name is vague to be reused for more external team identities.
    external_name = models.TextField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalteam"
        unique_together = (("team", "provider", "external_name"),)


class ExternalUser(DefaultFieldsModel):
    __core__ = False

    organizationmember = FlexibleForeignKey("sentry.OrganizationMember")
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.UNUSED_GH, "github"),
            (ExternalProviders.UNUSED_GL, "gitlab"),
        ),
    )
    # external_name => the Github/Gitlab username. Column name is vague to be reused for more external user identities.
    external_name = models.TextField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externaluser"
        unique_together = (("organizationmember", "provider", "external_name"),)
