from collections.abc import Sequence

from rest_framework.serializers import ListField


class EmptyListField(ListField):
    def to_internal_value(self, data: Sequence[object] | str) -> list[object]:
        if data == "":
            return []
        return super().to_internal_value(list(data))
