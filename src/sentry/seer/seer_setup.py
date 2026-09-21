from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.constants import SEER_GITLAB_SCM_PROVIDERS, SEER_SUPPORTED_SCM_PROVIDERS
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.settings import is_self_hosted


def get_supported_scm_providers(organization: Organization | None = None) -> list[str]:
    providers = list(SEER_SUPPORTED_SCM_PROVIDERS)
    if organization is not None and features.has("organizations:seer-gitlab-support", organization):
        providers.extend(SEER_GITLAB_SCM_PROVIDERS)
    return providers


def is_seer_available() -> bool:
    return not is_self_hosted()


def has_seer_access(
    organization: Organization | RpcOrganization,
    actor: User | AnonymousUser | RpcUser | None = None,
) -> bool:
    return (
        is_seer_available()
        and features.has("organizations:gen-ai-features", organization, actor=actor)
        and not bool(organization.get_option("sentry:hide_ai_features"))
    )


def has_seer_access_with_detail(
    organization: Organization | RpcOrganization,
    actor: User | AnonymousUser | RpcUser | None = None,
) -> tuple[bool, str | None]:
    if not is_seer_available() or not features.has(
        "organizations:gen-ai-features", organization, actor=actor
    ):
        return False, "Feature flag not enabled"

    if organization.get_option("sentry:hide_ai_features"):
        return False, "AI features are disabled for this organization."

    return True, None
