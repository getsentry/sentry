from typing import Any

from sentry.apidocs.schema import SentrySchema


class InvestigationSchema(SentrySchema):
    def _get_request_body(self, direction: str = "request") -> dict[str, Any] | None:
        # Archive and block deletion require versions in a JSON body. Spectacular
        # otherwise drops DELETE bodies even when request= is explicitly annotated.
        serializer = self.get_request_serializer()
        if self.method != "DELETE" or serializer is None:
            return super()._get_request_body(direction)
        schema, required = self._get_request_for_media_type(serializer, direction)
        media = {"schema": schema}
        examples = self._get_examples(serializer, direction, "application/json", None)
        if examples:
            media["examples"] = examples
        return {"content": {"application/json": media}, "required": required}
