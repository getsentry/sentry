from __future__ import annotations

import sentry_sdk
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
            hook_count = hooks.count()
            if webhook_url:
                expanded_events = expand_events(events)
                updated_hook_count = hooks.update(url=webhook_url, events=expanded_events)

                if updated_hook_count != hook_count:
                    sentry_sdk.set_context(
                        "hook info",
                        {
                            "application_id": application_id,
                            "updated_hook_count": updated_hook_count,
                            "expected_hook_count": hook_count,
                            "webhook_url": webhook_url,
                        },
                    )
                    sentry_sdk.capture_message(
                        "failed_to_update_all_hooks_for_app", level="warning"
                    )

                return [serialize_service_hook(h) for h in hooks]
            else:
                deletions.exec_sync_many(list(hooks))
                return []

    def update_webhook_and_events_for_app_by_region(
        self,
        *,
        application_id: int | None,
        webhook_url: str | None,
        events: list[str],
        region_name: str,
    ) -> list[RpcServiceHook]:
        with transaction.atomic(router.db_for_write(ServiceHook)):
            hooks = ServiceHook.objects.filter(application_id=application_id)
            hook_count = hooks.count()
            if webhook_url:
                expanded_events = expand_events(events)
                updated_hook_count = hooks.update(url=webhook_url, events=expanded_events)

                if hook_count != updated_hook_count:
                    sentry_sdk.set_context(
                        "hook info",
                        {
                            "application_id": application_id,
                            "updated_hook_count": updated_hook_count,
                            "expected_hook_count": hook_count,
                        },
                    )
                    sentry_sdk.capture_message(
                        "failed_to_update_all_hooks_for_app", level="warning"
                    )
                return [serialize_service_hook(h) for h in hooks]
            else:
                deletions.exec_sync_many(list(hooks))
                return []

    def create_or_update_webhook_and_events_for_installation(
        self,
        *,
        installation_id: int,
        organization_id: int,
        webhook_url: str | None,
        events: list[str],
        application_id: int,
    ) -> list[RpcServiceHook]:
        with transaction.atomic(router.db_for_write(ServiceHook)):
            if webhook_url:
                hook, created = ServiceHook.objects.update_or_create(
                    installation_id=installation_id,
                    application_id=application_id,
                    defaults={
                        "application_id": application_id,
                        "actor_id": installation_id,
                        "installation_id": installation_id,
                        "url": webhook_url,
                        "events": expand_events(events),
                    },
                )
                return [serialize_service_hook(hook)]
            else:
                # If no webhook_url, try to find and delete existing hook
                try:
                    hook = ServiceHook.objects.get(
                        installation_id=installation_id, application_id=application_id
                    )
                    deletions.exec_sync(hook)
                except ServiceHook.DoesNotExist:
                    pass
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
