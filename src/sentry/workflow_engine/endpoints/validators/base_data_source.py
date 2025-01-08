from collections.abc import Callable
from typing import Generic, TypeVar

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
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
