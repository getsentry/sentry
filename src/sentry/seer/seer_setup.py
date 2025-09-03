from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.models.promptsactivity import PromptsActivity
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

feature_name = "seer_autofix_setup_acknowledged"


def get_seer_user_acknowledgement(user_id: int, org_id: int) -> bool:
    return PromptsActivity.objects.filter(
        user_id=user_id,
        feature=feature_name,
        organization_id=org_id,
        project_id=0,
    ).exists()


def get_seer_org_acknowledgement(org_id: int) -> bool:
    return PromptsActivity.objects.filter(
        feature=feature_name,
        organization_id=org_id,
        project_id=0,
    ).exists()


def has_seer_access(
    organization: Organization, actor: User | AnonymousUser | RpcUser | None = None
) -> bool:
    return (
        features.has("organizations:gen-ai-features", organization, actor=actor)
        and not bool(organization.get_option("sentry:hide_ai_features"))
        and get_seer_org_acknowledgement(org_id=organization.id)
    )
