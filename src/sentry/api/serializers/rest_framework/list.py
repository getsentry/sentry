from typing import Any

from rest_framework.serializers import ListField


class EmptyListField(ListField):
    def to_internal_value(self, data: Any) -> list[Any]:
        if data == "":
            return []
        return super().to_internal_value(data)
