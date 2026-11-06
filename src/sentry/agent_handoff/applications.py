from collections.abc import Sequence

from sentry import options
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus


def get_handoff_application(scope_list: Sequence[str]) -> ApiApplication | None:
    client_id = options.get("onboarding.agent-handoff.client-id")
    if not client_id or client_id not in options.get("oauth.setup-code.allowed-client-ids"):
        return None

    application = ApiApplication.objects.filter(
        client_id=client_id, status=ApiApplicationStatus.active
    ).first()
    if (
        application is None
        or not application.is_public
        or (
            application.requires_org_level_access
            and not set(scope_list).issubset(application.scopes)
        )
    ):
        return None
    return application
