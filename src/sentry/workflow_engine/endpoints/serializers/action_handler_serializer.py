from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.rules.actions.notify_event_service import PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS
from sentry.workflow_engine.types import ActionHandler


def json_schema_to_api(schema: dict[str, Any]) -> dict[str, Any]:
    def convert(value: Any) -> Any:
        if isinstance(value, list):
            return [convert(item) for item in value]
        if not isinstance(value, dict):
            return value

        result = {key: convert(item) for key, item in value.items()}
        if isinstance(properties := value.get("properties"), dict):
            result["properties"] = {
                snake_to_camel_case(name): convert(spec) for name, spec in properties.items()
            }
        if isinstance(required := value.get("required"), list):
            result["required"] = [snake_to_camel_case(field) for field in required]
        return result

    return convert(schema)


class SentryAppContext(TypedDict):
    id: str
    name: str
    installationId: str
    installationUuid: str
    status: int
    settings: NotRequired[dict[str, Any]]
    title: NotRequired[str]


class AvailableActionService(TypedDict):
    id: str
    name: str


class AvailableActionIntegration(TypedDict):
    id: str
    name: str
    services: NotRequired[list[AvailableActionService]]


class AvailableWebhookService(TypedDict):
    slug: str
    name: str


class ActionHandlerSerializerResponse(TypedDict):
    type: str
    handlerGroup: str
    configSchema: dict[str, Any]
    dataSchema: dict[str, Any]
    sentryApp: NotRequired[SentryAppContext]
    integrations: NotRequired[list[AvailableActionIntegration]]
    services: NotRequired[list[AvailableWebhookService]]


@register(ActionHandler)
class ActionHandlerSerializer(Serializer[ActionHandlerSerializerResponse]):
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
            "configSchema": json_schema_to_api(obj.get_api_config_schema()),
            "dataSchema": json_schema_to_api(obj.data_schema),
        }

        integrations = kwargs.get("integrations")
        if integrations:
            integrations_result: list[AvailableActionIntegration] = []
            for i in integrations:
                i_result: AvailableActionIntegration = {
                    "id": str(i["integration"].id),
                    "name": i["integration"].name,
                }
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
            services_list: list[AvailableWebhookService] = [
                {"slug": service.slug, "name": self.transform_title(service.title)}
                for service in services
            ]
            services_list.sort(key=lambda x: x["name"])
            result["services"] = services_list

        return result
