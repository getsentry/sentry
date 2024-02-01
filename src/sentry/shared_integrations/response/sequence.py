from __future__ import annotations

from typing import Any, Sequence

from sentry.shared_integrations.response.base import BaseApiResponse


class SequenceApiResponse(list, BaseApiResponse):
    def __init__(self, data: Sequence[Any], *args: Any, **kwargs: Any) -> None:
        list.__init__(self, data)
        BaseApiResponse.__init__(self, *args, **kwargs)

    @property
    def json(self) -> Any:
        return self
