from collections.abc import Callable
from typing import Generic, TypeVar

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeModelSerializer
from sentry.db.models import Model
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DataSourceTypeHandler

T = TypeVar("T", bound=Model)


class DataSourceCreator(Generic[T]):
    def __init__(self, create_fn: Callable[[], T]):
        self._create_fn = create_fn
        self._instance: T | None = None

    def create(self) -> T:
        if self._instance is None:
            self._instance = self._create_fn()
        return self._instance


class BaseDataSourceValidator(CamelSnakeModelSerializer[T], Generic[T]):
    @property
    def data_source_type_handler(self) -> type[DataSourceTypeHandler]:
        raise NotImplementedError

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs["_creator"] = DataSourceCreator[T](lambda: self.validated_create_source(attrs))
        attrs["data_source_type"] = data_source_type_registry.get_key(self.data_source_type_handler)
        return attrs

    def validated_create_source(self, validated_data) -> T:
        """
        Validates that the number of instances of this data source type for the organization
        does not exceed the limit.
        """
        limit = self.data_source_type_handler.get_instance_limit(self.context["organization"])
        if limit is not None:
            current_instance_count = self.data_source_type_handler.get_current_instance_count(
                self.context["organization"]
            )
            if current_instance_count >= limit:
                raise serializers.ValidationError(
                    f"You may not exceed {limit} data sources of this type."
                )
        return self.create_source(validated_data)

    def create_source(self, validated_data) -> T:
        """
        Create the data source. In most cases, you should call `validated_create_source` instead.
        """
        raise NotImplementedError
