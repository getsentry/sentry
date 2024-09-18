from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.hook import hook_service


def create_or_update_service_hooks_for_installation(
    installation: SentryAppInstallation, webhook_url: str | None, events: list[str]
) -> None:
    """
    This function creates or updates service hooks for a given Sentry app installation.
    It first attempts to update the webhook URL and events for existing service hooks.
    If no hooks are found and a webhook URL is provided, it creates a new service hook.
    Should only be called in the control silo
    """
    hooks = hook_service.update_webhook_and_events(
        organization_id=installation.organization_id,
        application_id=installation.sentry_app.application_id,
        webhook_url=webhook_url,
        events=events,
    )
    if webhook_url and not hooks:
        # Note that because the update transaction is disjoint with this transaction, it is still
        # possible we redundantly create service hooks in the face of two concurrent requests.
        # If this proves a problem, we would need to add an additional semantic, "only create if does not exist".
        # But I think, it should be fine.
        hook_service.create_service_hook(
            application_id=installation.sentry_app.application_id,
            actor_id=installation.id,
            installation_id=installation.id,
            organization_id=installation.organization_id,
            project_ids=[],
            events=events,
            url=webhook_url,
        )
