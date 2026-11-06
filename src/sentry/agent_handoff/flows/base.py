from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from rest_framework.serializers import BaseSerializer


class InvalidHandoffContext(ValueError):
    pass


Context = TypeVar("Context")


class Flow(ABC, Generic[Context]):
    def get_context_serializer(self) -> type[BaseSerializer[Context]] | None:
        return None

    @abstractmethod
    def render(self, context: object, *, user_id: int, organization_id: int) -> str:
        pass

    @abstractmethod
    def preview(self) -> str:
        pass
