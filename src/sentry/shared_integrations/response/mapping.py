from __future__ import annotations

from typing import Any, Mapping

from sentry.shared_integrations.response.base import BaseApiResponse


class MappingApiResponse(dict, BaseApiResponse):
    def __init__(self, data: Mapping[str, Any], *args: Any, **kwargs: Any) -> None:
        dict.__init__(self, data)
        BaseApiResponse.__init__(self, *args, **kwargs)

    @property
    def json(self) -> Any:
        return self
