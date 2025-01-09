from collections.abc import Sequence
from typing import TypedDict

from django.db import router, transaction
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.constants import SentryAppInstallationStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.utils.channel import get_channel_id, validate_channel_id
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import (
    ActionService,
    ActionTarget,
    NotificationAction,
)
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.utils.strings import oxfordize_list


def format_choices_text(choices: Sequence[tuple[int, str]]):
    choices_as_display_text = [f"'{display_text}'" for (_, display_text) in choices]
    return oxfordize_list(choices_as_display_text)


INTEGRATION_SERVICES = {
    ActionService.PAGERDUTY.value,
    ActionService.SLACK.value,
    ActionService.MSTEAMS.value,
    ActionService.OPSGENIE.value,
}


# Note the ordering of fields affects the Spike Protection API Documentation
class NotificationActionInputData(TypedDict, total=False):
    trigger_type: int
    service_type: int
    integration_id: int
    target_identifier: str
    target_display: str
    projects: list[Project]
    sentry_app_id: int
    target_type: int


@extend_schema_serializer(exclude_fields=["sentry_app_id", "target_type"])
class NotificationActionSerializer(CamelSnakeModelSerializer):
    """
    Django Rest Framework serializer for incoming NotificationAction API payloads
    """

    trigger_type = serializers.CharField(
        help_text="""Type of the trigger that causes the notification. The only supported trigger right now is: `spike-protection`."""
    )
    service_type = serializers.CharField(
        help_text="Service that is used for sending the notification.\n"
        + """- `email`\n"""
        + """- `slack`\n"""
        + """- `sentry_notification`\n"""
        + """- `pagerduty`\n"""
        + """- `opsgenie`\n"""
    )
    integration_id = serializers.IntegerField(
        help_text="""ID of the integration used as the notification service. See
[List Integrations](https://docs.sentry.io/api/integrations/list-an-organizations-available-integrations/)
to retrieve a full list of integrations.

Required if **service_type** is `slack`, `pagerduty` or `opsgenie`.
""",
        required=False,
    )
    target_identifier = serializers.CharField(
        help_text="""ID of the notification target, like a Slack channel ID.

Required if **service_type** is `slack` or `opsgenie`.
""",
        required=False,
    )
    target_display = serializers.CharField(
        help_text="""Name of the notification target, like a Slack channel name.

Required if **service_type** is `slack` or `opsgenie`.
""",
        required=False,
    )
    projects = serializers.ListField(
        help_text="""List of projects slugs that the Notification Action is created for.""",
        child=ProjectField(scope="project:read"),
        required=False,
    )
    # Optional and not needed for spike protection so not documenting
    # TODO: Include in documentation when any notification action works with sentry_app_id
    sentry_app_id = serializers.IntegerField(
        required=False,
    )
    # TODO: Include in documentation when any notification action works with anything other than "specific"
    target_type = serializers.CharField(
        required=False,
        default="specific",
    )

    def validate_integration_id(self, integration_id: int) -> int:
        organization_integration = integration_service.get_organization_integration(
            integration_id=integration_id,
            organization_id=self.context["organization"].id,
        )
        if not organization_integration:
            raise serializers.ValidationError("Integration does not exist, or is not installed")
        return integration_id

    def validate_sentry_app_id(self, sentry_app_id: int) -> int:
        try:
            SentryAppInstallation.objects.get(
                organization_id=self.context["organization"].id,
                sentry_app_id=sentry_app_id,
                status=SentryAppInstallationStatus.INSTALLED,
            )
        except SentryAppInstallation.DoesNotExist:
            raise serializers.ValidationError("Sentry App does not exist, or is not installed")
        return sentry_app_id

    def validate_service_type(self, service_type: str) -> int:
        service_type_value = ActionService.get_value(service_type)
        if service_type_value is None:
            service_text = format_choices_text(ActionService.as_choices())
            raise serializers.ValidationError(
                f"Invalid service selected. Choose from {service_text}."
            )
        return service_type_value

    def validate_target_type(self, target_type: str) -> int:
        target_type_value = ActionTarget.get_value(target_type)
        if target_type_value is None:
            target_text = format_choices_text(ActionTarget.as_choices())
            raise serializers.ValidationError(
                f"Invalid target selected. Choose from {target_text}."
            )
        return target_type_value

    def validate_trigger_type(self, trigger_type: str) -> int:
        valid_triggers: dict[str, int] = {v: k for k, v in NotificationAction.get_trigger_types()}
        trigger_type_value = valid_triggers.get(trigger_type)
        if trigger_type_value is None:
            trigger_text = format_choices_text(NotificationAction.get_trigger_types())
            raise serializers.ValidationError(
                f"Invalid trigger selected. Choose from {trigger_text}."
            )
        return trigger_type_value

    def validate_integration_and_service(self, data: NotificationActionInputData):
        if data["service_type"] not in INTEGRATION_SERVICES:
            return

        service_provider = ActionService.get_name(data["service_type"])
        if data.get("integration_id") is None:
            raise serializers.ValidationError(
                {
                    "integration_id": f"Service type of '{service_provider}' requires providing an active integration id"
                }
            )
        integration = integration_service.get_integration(integration_id=data.get("integration_id"))
        if integration is None:
            raise serializers.ValidationError(
                f"Service type of '{service_provider}' requires having an active integration"
            )

        if integration and service_provider != integration.provider:
            raise serializers.ValidationError(
                {
                    "integration_id": f"Integration of provider '{integration.provider}' does not match service type of '{service_provider}'"
                }
            )
        self.integration = integration

    def validate_sentry_app_and_service(self, data: NotificationActionInputData):
        if (
            data["service_type"] == ActionService.SENTRY_APP.value
            and data.get("sentry_app_id") is None
        ):
            service_type = ActionService.get_name(data["service_type"])
            raise serializers.ValidationError(
                {
                    "sentry_app_id": f"Service type of '{service_type}' requires providing a sentry app id"
                }
            )

    def validate_with_registry(self, data: NotificationActionInputData):
        registration = NotificationAction.get_registration(
            trigger_type=data["trigger_type"],
            service_type=data["service_type"],
            target_type=data["target_type"],
        )
        if not registration:
            raise serializers.ValidationError(
                "Combination of trigger_type, service_type and target_type has not been registered."
            )
        registration.validate_action(data=data)

    def validate_slack_channel(
        self, data: NotificationActionInputData
    ) -> NotificationActionInputData:
        """
        Validates that SPECIFIC targets for SLACK service has the following target data:
            target_display: Slack channel name
            target_identifier: Slack channel id (optional)
        NOTE: Reaches out to via slack integration to verify channel
        """
        if (
            data["service_type"] != ActionService.SLACK.value
            or data["target_type"] != ActionTarget.SPECIFIC.value
        ):
            return data

        channel_name = data.get("target_display")
        channel_id = data.get("target_identifier")
        if not channel_name:
            raise serializers.ValidationError(
                {"target_display": "Did not receive a slack user or channel name."}
            )

        # If we've received a channel and id, verify them against one another
        if channel_name and channel_id:
            try:
                validate_channel_id(
                    name=channel_name,
                    integration_id=self.integration.id,
                    input_channel_id=channel_id,
                )
            except Exception as e:
                # validate_channel_id raises user friendly validation errors!
                # TODO (christinarlong): Figure out what specific exceptions to catch here to prevent leaks
                raise serializers.ValidationError({"target_display": str(e)})
            return data

        # If we've only received a channel name, ask slack for its id
        generic_error_message = f"Could not fetch channel id from Slack for '{channel_name}'. Try providing the channel id, or try again later."
        try:
            channel_data = get_channel_id(integration=self.integration, channel_name=channel_name)
        except Exception:
            raise serializers.ValidationError({"target_display": generic_error_message})

        if not channel_data.channel_id:
            raise serializers.ValidationError({"target_display": generic_error_message})

        if channel_data.timed_out:
            raise serializers.ValidationError(
                {
                    "target_identifier": "Please provide a slack channel id, we encountered an error while searching for it via the channel name."
                }
            )
        data["target_identifier"] = channel_data.channel_id
        return data

    def validate_discord_channel(
        self, data: NotificationActionInputData
    ) -> NotificationActionInputData:
        """
        Validates that SPECIFIC targets for DISCORD service have the following target data:
            target_display: Discord channel name
            target_identifier: Discord channel id
        NOTE: Reaches out to via discord integration to verify channel
        """
        from sentry.integrations.discord.utils.channel import validate_channel_id

        if (
            data["service_type"] != ActionService.DISCORD.value
            or data["target_type"] != ActionTarget.SPECIFIC.value
        ):
            return data

        channel_name = data.get("target_display", None)
        channel_id = data.get("target_identifier", None)

        if channel_id is None or channel_name is None:
            raise serializers.ValidationError(
                {"target_identifier": "Did not receive a discord channel id or name."}
            )

        try:
            validate_channel_id(
                channel_id=channel_id,
                guild_id=self.integration.external_id,
                guild_name=self.integration.name,
            )
        except Exception as e:
            raise serializers.ValidationError({"target_identifier": str(e)})

        return data

    def validate_pagerduty_service(
        self, data: NotificationActionInputData
    ) -> NotificationActionInputData:
        """
        Validates that SPECIFIC targets for PAGERDUTY service has the following target data:
            target_display: PagerDutyService.service_name
            target_identifier: PagerDutyService.id
        """
        if (
            data["service_type"] != ActionService.PAGERDUTY.value
            or data["target_type"] != ActionTarget.SPECIFIC.value
        ):
            return data

        service_id = data.get("target_identifier")
        ois = integration_service.get_organization_integrations(
            organization_id=self.context["organization"].id,
            integration_id=self.integration.id,
        )

        if not service_id:
            pd_service_options = [
                f"{pds['id']} ({pds['service_name']})"
                for oi in ois
                for pds in oi.config.get("pagerduty_services", [])
            ]

            raise serializers.ValidationError(
                {
                    "target_identifier": f" Did not recieve PagerDuty service id for the '{self.integration.name}' account, Choose from {oxfordize_list(pd_service_options)}"
                }
            )

        try:
            pds = next(
                pds
                for oi in ois
                for pds in oi.config.get("pagerduty_services", [])
                if service_id == str(pds["id"])
            )
        except StopIteration:
            raise serializers.ValidationError(
                {
                    "target_identifier": f"Could not find associated PagerDuty service for the '{self.integration.name}' account. If it exists, ensure Sentry has access."
                }
            )
        data["target_display"] = pds["service_name"]
        data["target_identifier"] = pds["id"]
        return data

    def validate(self, data: NotificationActionInputData) -> NotificationActionInputData:
        self.validate_integration_and_service(data)
        self.validate_sentry_app_and_service(data)
        self.validate_with_registry(data)

        data = self.validate_slack_channel(data)
        data = self.validate_pagerduty_service(data)
        data = self.validate_discord_channel(data)

        return data

    class Meta:
        model = NotificationAction
        fields = list(NotificationActionInputData.__annotations__.keys())

    def create(self, validated_data: NotificationActionInputData) -> NotificationAction:
        projects = validated_data.pop("projects", [])
        service_type = validated_data.pop("service_type")
        action = NotificationAction(
            type=service_type,
            organization_id=self.context["organization"].id,
            **validated_data,
        )
        with transaction.atomic(router.db_for_write(NotificationAction)):
            action.save()
            action.projects.set(projects)
        return action

    def update(
        self, instance: NotificationAction, validated_data: NotificationActionInputData
    ) -> NotificationAction:
        projects = validated_data.pop("projects", [])
        service_type = validated_data.pop("service_type")
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.type = service_type
        with transaction.atomic(router.db_for_write(NotificationAction)):
            instance.save()
            instance.projects.set(projects)
        return instance
