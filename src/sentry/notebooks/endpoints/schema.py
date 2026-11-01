from collections.abc import Callable
from typing import Any, cast

from django.urls import resolve

from sentry.apidocs.schema import SentrySchema


class InvestigationSchema(SentrySchema):
    def is_excluded(self) -> bool:
        # List each operation once, under /notebooks/, while it also serves at /investigations/.
        if "/investigations/" in self.path:
            match = resolve(self.path.replace("/investigations/", "/notebooks/", 1))
            if getattr(match.func, "view_class", None) is type(self.view):
                return True
        return super().is_excluded()

    def _get_request_body(self, direction: str = "request") -> dict[str, Any] | None:
        # Archive and block deletion require versions in a JSON body. Spectacular
        # otherwise drops DELETE bodies even when request= is explicitly annotated.
        serializer = self.get_request_serializer()
        if self.method != "DELETE" or serializer is None:
            # justification: drf-spectacular does not annotate _get_request_body.
            return cast("Callable[..., dict[str, Any] | None]", super()._get_request_body)(
                direction
            )
        # justification: drf-spectacular does not annotate _get_request_for_media_type.
        get_request_for_media_type = cast(
            "Callable[[object, str], tuple[dict[str, Any], bool]]",
            self._get_request_for_media_type,
        )
        schema, required = get_request_for_media_type(serializer, direction)
        # justification: schema and examples are OpenAPI JSON fragments.
        media: dict[str, Any] = {"schema": schema}
        # justification: drf-spectacular does not annotate _get_examples.
        get_examples = cast("Callable[..., list[dict[str, Any]] | None]", self._get_examples)
        examples = get_examples(serializer, direction, "application/json", None)
        if examples:
            media["examples"] = examples
        return {"content": {"application/json": media}, "required": required}
