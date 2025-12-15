from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.rules.actions.notify_event_service import PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS
from sentry.workflow_engine.types import ActionHandler


class SentryAppContext(TypedDict):
    id: str
    name: str
    installationId: str
    installationUuid: str
    status: int
    settings: NotRequired[dict[str, Any]]
    title: NotRequired[str]


class ActionHandlerSerializerResponse(TypedDict):
    type: str
    handlerGroup: str
    configSchema: dict
    dataSchema: dict
    sentryApp: NotRequired[SentryAppContext]
    integrations: NotRequired[list]
    services: NotRequired[list]


@register(ActionHandler)
class ActionHandlerSerializer(Serializer):
    def transform_title(self, title: str) -> str:
        if title in PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS:
            return f"(Legacy) {title}"
        return title

    def serialize(
        self,
        obj: ActionHandler,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> ActionHandlerSerializerResponse:
        action_type = kwargs.get("action_type")
        if action_type is None:
            raise ValueError("action_type is required")

        result: ActionHandlerSerializerResponse = {
            "type": action_type,
            "handlerGroup": obj.group.value,
            "configSchema": obj.config_schema,
            "dataSchema": obj.data_schema,
        }

        integrations = kwargs.get("integrations")
        if integrations:
            integrations_result = []
            for i in integrations:
                i_result = {"id": str(i["integration"].id), "name": i["integration"].name}
                if i["services"]:
                    i_result["services"] = [
                        {"id": str(id), "name": name} for id, name in i["services"]
                    ]
                integrations_result.append(i_result)
            result["integrations"] = integrations_result

        sentry_app_context = kwargs.get("sentry_app_context")
        if sentry_app_context:
            installation = sentry_app_context.installation
            component = sentry_app_context.component
            sentry_app: SentryAppContext = {
                "id": str(installation.sentry_app.id),
                "name": installation.sentry_app.name,
                "installationId": str(installation.id),
                "installationUuid": str(installation.uuid),
                "status": installation.sentry_app.status,
            }
            if component:
                sentry_app["settings"] = component.app_schema.get("settings", {})
                if component.app_schema.get("title"):
                    sentry_app["title"] = component.app_schema.get("title")
            result["sentryApp"] = sentry_app

        services = kwargs.get("services")
        if services:
            services_list = [
                {"slug": service.slug, "name": self.transform_title(service.title)}
                for service in services
            ]
            services_list.sort(key=lambda x: x["name"])
            result["services"] = services_list

        return result
