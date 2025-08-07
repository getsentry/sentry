from sentry.models.promptsactivity import PromptsActivity

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
