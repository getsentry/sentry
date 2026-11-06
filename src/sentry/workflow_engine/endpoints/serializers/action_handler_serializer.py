from collections.abc import Mapping
from typing import Annotated, Any, Literal, NotRequired, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.rules.actions.notify_event_service import PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS
from sentry.workflow_engine.types import ActionHandler


class SentryAppContext(TypedDict):
    id: Annotated[str, ApiDescription("ID of the Sentry app")]
    name: Annotated[str, ApiDescription("Name of the Sentry app")]
    installationId: Annotated[str, ApiDescription("ID of the Sentry app installation")]
    installationUuid: Annotated[str, ApiDescription("UUID of the Sentry app installation")]
    status: Annotated[str, ApiDescription("Status of the Sentry app")]
    settings: NotRequired[
        Annotated[
            dict[str, Any],
            ApiDescription(
                "Settings form for the action, from the app's alert rule action component"
            ),
        ]
    ]
    title: NotRequired[
        Annotated[str, ApiDescription("Title of the app's alert rule action component")]
    ]


class AvailableActionService(TypedDict):
    id: Annotated[str, ApiDescription("ID of the service")]
    name: Annotated[str, ApiDescription("Name of the service")]


class AvailableActionIntegration(TypedDict):
    id: Annotated[str, ApiDescription("ID of the integration")]
    name: Annotated[str, ApiDescription("Name of the integration")]
    services: NotRequired[
        Annotated[
            list[AvailableActionService],
            ApiDescription("Services available in the integration, such as PagerDuty services"),
        ]
    ]


class AvailableWebhookService(TypedDict):
    slug: Annotated[str, ApiDescription("Slug of the webhook service")]
    name: Annotated[str, ApiDescription("Name of the webhook service")]


class ActionHandlerSerializerResponse(TypedDict):
    type: Annotated[str, ApiDescription("Type of the action")]
    handlerGroup: Annotated[
        str, ApiDescription("Group the action belongs to, such as notification or ticket_creation")
    ]
    configSchema: Annotated[dict[str, Any], ApiDescription("JSON schema of the action's config")]
    dataSchema: Annotated[dict[str, Any], ApiDescription("JSON schema of the action's data")]
    sentryApp: NotRequired[
        Annotated[
            SentryAppContext,
            ApiDescription("Sentry app that provides the action. Only set for Sentry app actions"),
        ]
    ]
    integrations: NotRequired[
        Annotated[
            list[AvailableActionIntegration], ApiDescription("Integrations the action can use")
        ]
    ]
    services: NotRequired[
        Annotated[
            list[AvailableWebhookService], ApiDescription("Webhook services the action can send to")
        ]
    ]
    disabledReason: NotRequired[
        Annotated[
            Literal["plan"],
            ApiDescription(
                "Why the action can't be used, such as plan. Omitted when it can be used"
            ),
        ]
    ]


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
            "configSchema": obj.config_schema,
            "dataSchema": obj.data_schema,
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

        disabled_reason = kwargs.get("disabled_reason")
        if disabled_reason:
            result["disabledReason"] = disabled_reason

        return result
