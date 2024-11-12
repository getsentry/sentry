from django.db import router, transaction
from rest_framework import serializers
from rest_framework.fields import Field

from sentry import audit_log
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.models import DataConditionGroup, Detector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.types import DetectorPriorityLevel


class BaseDataConditionValidator(CamelSnakeSerializer):

    condition = serializers.CharField(
        required=True,
        max_length=200,
        help_text="Condition used to compare data value to the stored comparison value",
    )

    @property
    def comparison(self) -> Field:
        raise NotImplementedError

    @property
    def result(self) -> Field:
        raise NotImplementedError

    @property
    def type(self) -> str:
        # TODO: This should probably at least be an enum
        raise NotImplementedError

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs["type"] = self.type
        return attrs


class NumericComparisonConditionValidator(BaseDataConditionValidator):

    comparison = serializers.FloatField(
        required=True,
        help_text="Comparison value to be compared against value from data.",
    )
    result = serializers.ChoiceField(
        choices=[
            (DetectorPriorityLevel.HIGH, "High"),
            (DetectorPriorityLevel.MEDIUM, "Medium"),
            (DetectorPriorityLevel.LOW, "Low"),
        ]
    )

    @property
    def supported_conditions(self) -> frozenset[Condition]:
        raise NotImplementedError

    @property
    def supported_results(self) -> frozenset[DetectorPriorityLevel]:
        raise NotImplementedError

    def validate_condition(self, value: str) -> Condition:
        try:
            condition = Condition(value)
        except ValueError:
            condition = None

        if condition not in self.supported_conditions:
            raise serializers.ValidationError(f"Unsupported condition {value}")
        return condition

    def validate_result(self, value: str) -> DetectorPriorityLevel:
        try:
            result = DetectorPriorityLevel(int(value))
        except ValueError:
            result = None
        if result not in self.supported_results:
            raise serializers.ValidationError("Unsupported condition result")
        return result


class BaseDataSourceValidator(CamelSnakeSerializer):
    pass


class BaseGroupTypeDetectorValidator(CamelSnakeSerializer):
    name = serializers.CharField(
        required=True,
        max_length=200,
        help_text="Name of the uptime monitor",
    )
    group_type = serializers.CharField()

    def validate_group_type(self, value: str) -> type[GroupType]:
        detector_type = grouptype.registry.get_by_slug(value)
        if detector_type is None:
            raise serializers.ValidationError("Unknown group type")
        if detector_type.detector_validator is None:
            raise serializers.ValidationError("Group type not compatible with detectors")
        # TODO: Probably need to check a feature flag to decide if a given
        # org/user is allowed to add a detector
        return detector_type

    @property
    def data_source(self) -> BaseDataSourceValidator:
        raise NotImplementedError

    @property
    def data_conditions(self) -> BaseDataConditionValidator:
        raise NotImplementedError

    def create(self, validated_data):
        # TODO: Implement data source abstraction
        # data_source_data = validated_data["data_source"]
        # data_source = DataSource.objects.create(
        #     data_source_data
        # )
        condition_data = validated_data["data_conditions"]
        with transaction.atomic(router.db_for_write(Detector)):
            condition_group = DataConditionGroup.objects.create(
                logic_type=DataConditionGroup.Type.ANY,
                organization_id=self.context["project"].organization_id,
            )
            for condition in condition_data:
                DataCondition.objects.create(
                    condition=condition["condition"],
                    comparison=condition["comparison"],
                    condition_result=condition["result"],
                    type=condition["type"],
                    condition_group=condition_group,
                )
            detector = Detector.objects.create(
                organization_id=self.context["project"].organization_id,
                name=validated_data["name"],
                workflow_condition_group=condition_group,
                type=validated_data["group_type"].slug,
            )

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["project"].organization,
                target_object=detector.id,
                event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
                data=detector.get_audit_log_data(),
            )
        return detector
