from typing import Dict, List, Tuple, TypedDict

from django.db import transaction
from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.constants import SentryAppInstallationStatus
from sentry.integrations.slack.utils.channel import get_channel_id, validate_channel_id
from sentry.models.integrations.pagerduty_service import PagerDutyService
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.notificationaction import ActionService, ActionTarget, NotificationAction
from sentry.models.project import Project
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.utils.strings import oxfordize_list


def format_choices_text(choices: List[Tuple[int, str]]):
    choices_as_display_text = [f"'{display_text}'" for (_, display_text) in choices]
    return oxfordize_list(choices_as_display_text)


INTEGRATION_SERVICES = {
    ActionService.PAGERDUTY.value,
    ActionService.SLACK.value,
    ActionService.MSTEAMS.value,
}


class NotificationActionInputData(TypedDict):
    integration_id: int
    sentry_app_id: int
    projects: List[Project]
    service_type: int
    trigger_type: int
    target_type: int
    target_identifier: str
    target_display: str


class NotificationActionSerializer(CamelSnakeModelSerializer):
    """
    Django Rest Framework serializer for incoming NotificationAction API payloads
    """

    integration_id = serializers.IntegerField(required=False)
    sentry_app_id = serializers.IntegerField(required=False)
    projects = serializers.ListField(child=ProjectField(scope="project:read"), required=False)

    service_type = serializers.CharField()
    target_type = serializers.CharField()
    trigger_type = serializers.CharField()

    target_identifier = serializers.CharField(required=False)
    target_display = serializers.CharField(required=False)

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
        valid_triggers: Dict[str, int] = {v: k for k, v in NotificationAction.get_trigger_types()}
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
                raise serializers.ValidationError({"target_display": str(e)})
            return data

        # If we've only received a channel name, ask slack for its id
        generic_error_message = f"Could not fetch channel id from Slack for '{channel_name}'. Try providing the channel id, or try again later."
        try:
            _prefix, channel_id, timed_out, = get_channel_id(
                organization=self.context["organization"],
                integration=self.integration,
                channel_name=channel_name,
            )
        except Exception:
            raise serializers.ValidationError({"target_display": generic_error_message})

        if not channel_id:
            raise serializers.ValidationError({"target_display": generic_error_message})

        if timed_out:
            raise serializers.ValidationError(
                {
                    "target_identifier": "Please provide a slack channel id, we encountered an error while earching for it via the channel name."
                }
            )
        data["target_identifier"] = channel_id
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

        if not service_id:
            pd_service_options = [
                f"{pds['id']} ({pds['service_name']})"
                for pds in PagerDutyService.objects.filter(
                    organization_id=self.context["organization"].id,
                    integration_id=self.integration.id,
                ).values("id", "service_name")
            ]

            raise serializers.ValidationError(
                {
                    "target_identifier": f" Did not recieve PagerDuty service id for the '{self.integration.name}' account, Choose from {oxfordize_list(pd_service_options)}"
                }
            )

        pds = PagerDutyService.objects.filter(
            organization_id=self.context["organization"].id,
            integration_id=self.integration.id,
        ).first()
        if not pds or str(pds.id) != service_id:
            raise serializers.ValidationError(
                {
                    "target_identifier": f"Could not find associated PagerDuty service for the '{self.integration.name}' account. If it exists, ensure Sentry has access."
                }
            )
        data["target_display"] = pds.service_name
        data["target_identifier"] = pds.id
        return data

    def validate(self, data: NotificationActionInputData) -> NotificationActionInputData:
        self.validate_integration_and_service(data)
        self.validate_sentry_app_and_service(data)
        self.validate_with_registry(data)

        data = self.validate_slack_channel(data)
        data = self.validate_pagerduty_service(data)

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
        with transaction.atomic():
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
        with transaction.atomic():
            instance.save()
            instance.projects.set(projects)
        return instance
