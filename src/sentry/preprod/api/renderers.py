from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import orjson
from rest_framework.renderers import BaseRenderer

from sentry.utils.json import better_default_encoder


class OrjsonRenderer(BaseRenderer):
    media_type = "application/json"
    format = "json"
    charset = None

    def render(
        self,
        data: Any,
        accepted_media_type: str | None = None,
        renderer_context: Mapping[str, Any] | None = None,
    ) -> bytes:
        if data is None:
            return b""
        return orjson.dumps(data, default=better_default_encoder)
