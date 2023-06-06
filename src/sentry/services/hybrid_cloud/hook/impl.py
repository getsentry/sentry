from __future__ import annotations

from typing import List, Optional

from django.db import transaction

from sentry import deletions
from sentry.models import ServiceHook
from sentry.sentry_apps.apps import expand_events
from sentry.services.hybrid_cloud.hook import HookService, RpcServiceHook
from sentry.services.hybrid_cloud.hook.serial import serialize_service_hook


class DatabaseBackedAppService(HookService):
    def update_webhook_and_events(
        self,
        *,
        application_id: Optional[int] = None,
        webhook_url: Optional[str] = None,
        events: List[str],
    ) -> List[RpcServiceHook]:
        hooks = ServiceHook.objects.filter(application_id=application_id)
        with transaction.atomic():
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
        application_id: Optional[int] = None,
        actor_id: int = -1,
        installation_id: Optional[int] = None,
        organization_id: int = -1,
        project_ids: Optional[List[int]] = None,
        events: Optional[List[str]] = None,
        url: str = "",
    ) -> RpcServiceHook:
        # nullable for sentry apps
        with transaction.atomic():
            project_id: Optional[int] = project_ids[0] if project_ids else None

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

    def close(self) -> None:
        pass
