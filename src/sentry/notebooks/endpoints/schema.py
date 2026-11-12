from collections.abc import Callable
from typing import Any, cast

from sentry.apidocs.schema import SentrySchema


class NotebookSchema(SentrySchema):
    def _get_request_body(self, direction: str = "request") -> dict[str, Any] | None:
        # Archive and block deletion require versions in a JSON body. Spectacular
        # otherwise drops DELETE bodies even when request= is explicitly annotated.
        serializer = self.get_request_serializer()
        if self.method != "DELETE" or serializer is None:
            return cast("Callable[..., dict[str, Any] | None]", super()._get_request_body)(
                direction
            )
        get_request_for_media_type = cast(
            "Callable[[object, str], tuple[dict[str, Any], bool]]",
            self._get_request_for_media_type,
        )
        schema, required = get_request_for_media_type(serializer, direction)
        media: dict[str, Any] = {"schema": schema}
        get_examples = cast("Callable[..., list[dict[str, Any]] | None]", self._get_examples)
        examples = get_examples(serializer, direction, "application/json", None)
        if examples:
            media["examples"] = examples
        return {"content": {"application/json": media}, "required": required}
