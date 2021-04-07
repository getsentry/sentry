import logging

from django.db import models

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    DefaultFieldsModel,
)
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders, get_provider_name

logger = logging.getLogger(__name__)


class ExternalProviderMixin:
    def get_provider_string(provider_int):
        return get_provider_name(provider_int) or "unknown"

    def get_provider_enum(provider_str):
        inv_providers_map = {v: k for k, v in EXTERNAL_PROVIDERS.items()}
        return inv_providers_map[provider_str].value if inv_providers_map[provider_str] else None


class ExternalTeam(DefaultFieldsModel, ExternalProviderMixin):
    __core__ = False

    team = FlexibleForeignKey("sentry.Team")
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.GITHUB, "github"),
            (ExternalProviders.GITLAB, "gitlab"),
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
        ),
    )
    # external_name => the Github/Gitlab team name. Column name is vague to be reused for more external team identities.
    external_name = models.TextField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalteam"
        unique_together = (("team", "provider", "external_name"),)


class ExternalUser(DefaultFieldsModel, ExternalProviderMixin):
    __core__ = False

    actor = FlexibleForeignKey(
        "sentry.Actor", db_index=True, unique=False, null=False, on_delete=models.CASCADE
    )
    organization = FlexibleForeignKey("sentry.Organization")
    integration = FlexibleForeignKey("sentry.Integration")
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.GITHUB, "github"),
            (ExternalProviders.GITLAB, "gitlab"),
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
        ),
    )
    # external_name => the Github/Gitlab username. Column name is vague to be reused for more external user identities.
    external_name = models.TextField()
    external_id = models.TextField()

    # deprecated
    organizationmember = FlexibleForeignKey("sentry.OrganizationMember")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externaluser"
        unique_together = (("organizationmember", "provider", "external_name"),)
