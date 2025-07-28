from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


def has_tempest_access(
    organization: Organization | None, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    has_feature = features.has("organizations:tempest-access", organization, actor=actor)

    if organization is None:
        return has_feature

    enabled_platforms = organization.get_option("sentry:enabled_console_platforms", [])
    has_playstation = "playstation" in enabled_platforms

    return has_feature or has_playstation
