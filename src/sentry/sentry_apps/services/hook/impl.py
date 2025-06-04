from __future__ import annotations

from django.db import router, transaction

from sentry import deletions
from sentry.sentry_apps.logic import expand_events
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.sentry_apps.services.hook import HookService, RpcServiceHook
from sentry.sentry_apps.services.hook.serial import serialize_service_hook


class DatabaseBackedHookService(HookService):
    def update_webhook_and_events(
        self,
        *,
        organization_id: int,
        application_id: int | None,
        webhook_url: str | None,
        events: list[str],
    ) -> list[RpcServiceHook]:
        with transaction.atomic(router.db_for_write(ServiceHook)):
            hooks = ServiceHook.objects.filter(application_id=application_id)
            if webhook_url:
                for hook in hooks:
                    hook.url = webhook_url
                    hook.events = expand_events(events)
                    hook.save()
                return [serialize_service_hook(h) for h in hooks]
            else:
                deletions.exec_sync_many(list(hooks))
                return []

    def create_service_hook(
        self,
        *,
        application_id: int | None = None,
        actor_id: int = -1,
        installation_id: int | None = None,
        organization_id: int = -1,
        project_ids: list[int] | None = None,
        events: list[str] | None = None,
        url: str = "",
    ) -> RpcServiceHook:
        # nullable for sentry apps
        with transaction.atomic(router.db_for_write(ServiceHook)):
            project_id: int | None = project_ids[0] if project_ids else None

            hook = ServiceHook.objects.create(
                application_id=application_id,
                actor_id=actor_id,
                project_id=project_id,
                organization_id=organization_id,
                events=expand_events(events or []),
                installation_id=installation_id,
                url=url,
            )
            if project_ids:
                for project_id in project_ids:
                    hook.add_project(project_id)

            return serialize_service_hook(hook)
