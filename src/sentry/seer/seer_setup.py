from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.models.promptsactivity import PromptsActivity
from sentry.options.rollout import in_rollout_group
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

feature_name = "seer_autofix_setup_acknowledged"


def get_seer_user_acknowledgement(user_id: int, organization: Organization) -> bool:
    # The consent requirement for generative AI features is being removed
    # After GA, remove all calls to this function
    if features.has("organizations:gen-ai-consent-flow-removal", organization):
        return True

    return PromptsActivity.objects.filter(
        user_id=user_id,
        feature=feature_name,
        organization_id=organization.id,
        project_id=0,
    ).exists()


def get_seer_org_acknowledgement(organization: Organization) -> bool:
    # The consent requirement for generative AI features is being removed
    # After GA, remove all calls to this function
    if features.has("organizations:gen-ai-consent-flow-removal", organization):
        return True

    return PromptsActivity.objects.filter(
        feature=feature_name,
        organization_id=organization.id,
        project_id=0,
    ).exists()


def get_seer_org_acknowledgement_for_scanner(organization: Organization) -> bool:
    return PromptsActivity.objects.filter(
        feature=feature_name,
        organization_id=organization.id,
        project_id=0,
    ).exists() or (
        features.has("organizations:gen-ai-consent-flow-removal", organization)
        and in_rollout_group("seer.scanner_no_consent.rollout_rate", organization.id)
    )


def has_seer_access(
    organization: Organization, actor: User | AnonymousUser | RpcUser | None = None
) -> bool:
    return (
        features.has("organizations:gen-ai-features", organization, actor=actor)
        and not bool(organization.get_option("sentry:hide_ai_features"))
        and get_seer_org_acknowledgement(organization)
    )


def has_seer_access_with_detail(
    organization: Organization, actor: User | AnonymousUser | RpcUser | None = None
) -> tuple[bool, str | None]:
    if not features.has("organizations:gen-ai-features", organization, actor=actor):
        return False, "Feature flag not enabled"

    if organization.get_option("sentry:hide_ai_features"):
        return False, "AI features are disabled for this organization."

    if not get_seer_org_acknowledgement(organization):
        return False, "Seer has not been acknowledged by the organization."

    return True, None
