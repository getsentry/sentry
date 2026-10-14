from rest_framework.serializers import ListField


class EmptyListField(ListField):
    def to_internal_value(  # type: ignore[override]  # "" passthrough widens accepted/returned types beyond list[Any]
        self, data: list[str] | str
    ) -> list[str] | str:
        if data == "":
            return ""
        # Anything else (including non-empty str) is validated — or rejected — by DRF itself.
        return super().to_internal_value(data)  # type: ignore[arg-type]
