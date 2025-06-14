import builtins

from django.db import router, transaction
from rest_framework import serializers

from sentry import audit_log
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.endpoints.validators.utils import get_unknown_detector_type_error
from sentry.workflow_engine.models import (
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.models.data_condition import DataCondition


class BaseDetectorTypeValidator(CamelSnakeSerializer):
    name = serializers.CharField(
        required=True,
        max_length=200,
        help_text="Name of the uptime monitor",
    )
    type = serializers.CharField()
    config = serializers.JSONField(default={})

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
    def data_sources(self) -> serializers.ListField:
        raise NotImplementedError

    @property
    def data_conditions(self) -> BaseDataConditionValidator:
        raise NotImplementedError

    def update(self, instance, validated_data):
        raise NotImplementedError

    def create(self, validated_data):
        with transaction.atomic(router.db_for_write(Detector)):
            condition_group = DataConditionGroup.objects.create(
                logic_type=DataConditionGroup.Type.ANY,
                organization_id=self.context["organization"].id,
            )

            detector = Detector.objects.create(
                project_id=self.context["project"].id,
                name=validated_data["name"],
                workflow_condition_group=condition_group,
                type=validated_data["type"].slug,
                config=validated_data.get("config", {}),
            )

            for validated_data_source in validated_data["data_sources"]:
                data_source_creator = validated_data_source["_creator"]
                data_source = data_source_creator.create()
                detector_data_source = DataSource.objects.create(
                    organization_id=self.context["project"].organization_id,
                    source_id=data_source.id,
                    type=validated_data_source["data_source_type"],
                )
                DataSourceDetector.objects.create(
                    data_source=detector_data_source, detector=detector
                )

            for condition in validated_data["condition_group"]["conditions"]:
                DataCondition.objects.create(
                    comparison=condition["comparison"],
                    condition_result=condition["condition_result"],
                    type=condition["type"],
                    condition_group=condition_group,
                )

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=detector.id,
                event=audit_log.get_event_id("DETECTOR_ADD"),
                data=detector.get_audit_log_data(),
            )
        return detector
