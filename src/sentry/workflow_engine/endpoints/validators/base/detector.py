import builtins
from typing import Any

from django.db import router, transaction
from rest_framework import serializers

from sentry import audit_log
from sentry.api.fields.actor import ActorField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDataConditionValidator,
    BaseDataSourceValidator,
)
from sentry.workflow_engine.endpoints.validators.utils import get_unknown_detector_type_error
from sentry.workflow_engine.models import (
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.models.data_condition import DataCondition
from sentry.workflow_engine.types import DataConditionType


class BaseDetectorTypeValidator(CamelSnakeSerializer):
    name = serializers.CharField(
        required=True,
        max_length=200,
        help_text="Name of the monitor",
    )
    type = serializers.CharField()
    config = serializers.JSONField(default={})
    owner = ActorField(required=False, allow_null=True)

    def validate_type(self, value: str) -> builtins.type[GroupType]:
        type = grouptype.registry.get_by_slug(value)
        if type is None:
            organization = self.context.get("organization")
            if organization:
                error_message = get_unknown_detector_type_error(value, organization)
            else:
                error_message = f"Unknown detector type '{value}'"
            raise serializers.ValidationError(error_message)
        if type.detector_settings is None or type.detector_settings.validator is None:
            raise serializers.ValidationError("Detector type not compatible with detectors")
        # TODO: Probably need to check a feature flag to decide if a given
        # org/user is allowed to add a detector
        return type

    @property
    def data_source(self) -> BaseDataSourceValidator:
        raise NotImplementedError

    @property
    def data_conditions(self) -> BaseDataConditionValidator:
        raise NotImplementedError

    def update(self, instance: Detector, validated_data: dict[str, Any]):
        instance.name = validated_data.get("name", instance.name)
        instance.type = validated_data.get("detector_type", instance.group_type).slug

        # Handle owner field update
        if "owner" in validated_data:
            owner = validated_data.get("owner")
            if owner:
                if owner.is_user:
                    instance.owner_user_id = owner.id
                    instance.owner_team_id = None
                elif owner.is_team:
                    instance.owner_user_id = None
                    instance.owner_team_id = owner.id
            else:
                # Clear owner if None is passed
                instance.owner_user_id = None
                instance.owner_team_id = None

        condition_group = validated_data.pop("condition_group")
        data_conditions: list[DataConditionType] = condition_group.get("conditions")

        if data_conditions and instance.workflow_condition_group:
            group_validator = BaseDataConditionGroupValidator()
            group_validator.update(instance.workflow_condition_group, condition_group)

        instance.save()

        create_audit_entry(
            request=self.context["request"],
            organization=self.context["organization"],
            target_object=instance.id,
            event=audit_log.get_event_id("DETECTOR_EDIT"),
            data=instance.get_audit_log_data(),
        )
        return instance

    def create(self, validated_data):
        with transaction.atomic(router.db_for_write(Detector)):
            condition_group = DataConditionGroup.objects.create(
                logic_type=DataConditionGroup.Type.ANY,
                organization_id=self.context["organization"].id,
            )
            data_source_creator = validated_data["data_source"]["_creator"]
            data_source = data_source_creator.create()
            detector_data_source = DataSource.objects.create(
                organization_id=self.context["project"].organization_id,
                source_id=data_source.id,
                type=validated_data["data_source"]["data_source_type"],
            )
            for condition in validated_data["condition_group"]["conditions"]:
                DataCondition.objects.create(
                    comparison=condition["comparison"],
                    condition_result=condition["condition_result"],
                    type=condition["type"],
                    condition_group=condition_group,
                )

            owner = validated_data.get("owner")
            owner_user_id = None
            owner_team_id = None
            if owner:
                if owner.is_user:
                    owner_user_id = owner.id
                elif owner.is_team:
                    owner_team_id = owner.id

            detector = Detector.objects.create(
                project_id=self.context["project"].id,
                name=validated_data["name"],
                workflow_condition_group=condition_group,
                type=validated_data["type"].slug,
                config=validated_data.get("config", {}),
                owner_user_id=owner_user_id,
                owner_team_id=owner_team_id,
                created_by_id=self.context["request"].user.id,
            )
            DataSourceDetector.objects.create(data_source=detector_data_source, detector=detector)

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=detector.id,
                event=audit_log.get_event_id("DETECTOR_ADD"),
                data=detector.get_audit_log_data(),
            )
        return detector
