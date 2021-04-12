import logging
from enum import Enum
from typing import Optional

from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, DefaultFieldsModel, FlexibleForeignKey

logger = logging.getLogger(__name__)


class ExternalProviders(Enum):
    GITHUB = 0
    GITLAB = 1
    EMAIL = 100
    SLACK = 110


EXTERNAL_PROVIDERS = {
    ExternalProviders.GITHUB: "github",
    ExternalProviders.GITLAB: "gitlab",
    ExternalProviders.EMAIL: "email",
    ExternalProviders.SLACK: "slack",
}


def get_provider_name(value: int) -> Optional[str]:
    return EXTERNAL_PROVIDERS.get(ExternalProviders(value))


class ExternalProviderMixin:
    def get_provider_string(provider_int):
        return get_provider_name(provider_int) or "unknown"

    def get_provider_enum(provider_str):
        inv_providers_map = {v: k for k, v in EXTERNAL_PROVIDERS.items()}
        return inv_providers_map[provider_str].value if inv_providers_map[provider_str] else None


class ExternalActor(DefaultFieldsModel, ExternalProviderMixin):
    __core__ = False

    actor = FlexibleForeignKey("sentry.Actor", null=True)
    organization = FlexibleForeignKey("sentry.Organization")
    integration = FlexibleForeignKey("sentry.Integration", null=True)
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.GITHUB, "github"),
            (ExternalProviders.GITLAB, "gitlab"),
            (ExternalProviders.SLACK, "slack"),
        ),
    )

    # external name => display name i.e. username, team name, channel name
    # external id => unique identifier i.e user id, channel id
    external_name = models.TextField()
    external_id = models.TextField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalactor"
        unique_together = ("organization", "provider", "external_name")
