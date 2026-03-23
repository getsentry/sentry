from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


def has_seer_access(
    organization: Organization, actor: User | AnonymousUser | RpcUser | None = None
) -> bool:
    return features.has("organizations:gen-ai-features", organization, actor=actor) and not bool(
        organization.get_option("sentry:hide_ai_features")
    )


def has_seer_access_with_detail(
    organization: Organization, actor: User | AnonymousUser | RpcUser | None = None
) -> tuple[bool, str | None]:
    if not features.has("organizations:gen-ai-features", organization, actor=actor):
        return False, "Feature flag not enabled"

    if organization.get_option("sentry:hide_ai_features"):
        return False, "AI features are disabled for this organization."

    return True, None
