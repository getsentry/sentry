from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


def has_seer_permissions(
    organization: Organization, actor: User | AnonymousUser | RpcUser | None = None
) -> bool:
    return (
        features.has(
            "organizations:gen-ai-features", organization, **({"actor": actor} if actor else {})
        )
        and not bool(organization.get_option("sentry:hide_ai_features"))
        and get_seer_org_acknowledgement(org_id=organization.id)
    )
