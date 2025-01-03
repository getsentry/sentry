from collections.abc import Callable
from typing import Generic, TypeVar

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.fields import Field

from sentry import audit_log
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.db.models import Model
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.models import (
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DataSourceTypeHandler, DetectorPriorityLevel

T = TypeVar("T", bound=Model)


class DataSourceCreator(Generic[T]):
    def __init__(self, create_fn: Callable[[], T]):
        self._create_fn = create_fn
        self._instance: T | None = None

    def create(self) -> T:
        if self._instance is None:
            self._instance = self._create_fn()
        return self._instance


class BaseDataConditionValidator(CamelSnakeSerializer):

    type = serializers.CharField(
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

    def validate(self, attrs):
        attrs = super().validate(attrs)
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

    def validate_type(self, value: str) -> Condition:
        try:
            type = Condition(value)
        except ValueError:
            type = None

        if type not in self.supported_conditions:
            raise serializers.ValidationError(f"Unsupported type {value}")
        return type

    def validate_result(self, value: str) -> DetectorPriorityLevel:
        try:
            result = DetectorPriorityLevel(int(value))
        except ValueError:
            result = None
        if result not in self.supported_results:
            raise serializers.ValidationError("Unsupported condition result")
        return result


class BaseDataSourceValidator(CamelSnakeSerializer, Generic[T]):
    @property
    def data_source_type_handler(self) -> type[DataSourceTypeHandler]:
        raise NotImplementedError

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs["_creator"] = DataSourceCreator[T](lambda: self.create_source(attrs))
        attrs["data_source_type"] = data_source_type_registry.get_key(self.data_source_type_handler)
        return attrs

    def create_source(self, validated_data) -> T:
        raise NotImplementedError


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
        with transaction.atomic(router.db_for_write(Detector)):
            condition_group = DataConditionGroup.objects.create(
                logic_type=DataConditionGroup.Type.ANY,
                organization_id=self.context["organization"].id,
            )
            data_source_creator = validated_data["data_source"]["_creator"]
            data_source = data_source_creator.create()
            detector_data_source = DataSource.objects.create(
                organization_id=self.context["project"].organization_id,
                query_id=data_source.id,
                type=validated_data["data_source"]["data_source_type"],
            )
            for condition in validated_data["data_conditions"]:
                DataCondition.objects.create(
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
            DataSourceDetector.objects.create(data_source=detector_data_source, detector=detector)

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=detector.id,
                event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
                data=detector.get_audit_log_data(),
            )
        return detector
