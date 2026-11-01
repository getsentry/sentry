__all__ = ("Breadcrumbs",)

from collections.abc import Mapping
from datetime import datetime
from typing import Any, Self

from sentry.interfaces.base import Interface
from sentry.utils.dates import parse_timestamp, to_datetime
from sentry.utils.json import prune_empty_keys
from sentry.utils.safe import get_path


class Breadcrumbs(Interface):
    """
    This interface stores information that leads up to an error.

    - ``message`` must be no more than 1000 characters in length.

    >>> [{
    >>>     "type": "message",
    >>>     // timestamp can be ISO format or a unix timestamp (as float)
    >>>     "timestamp": "2016-01-17T12:30:00",
    >>>     "data": {
    >>>         "message": "My raw message with interpreted strings like %s",
    >>>     }
    >>> ], ...}
    """

    display_score = 1100
    score = 800

    @classmethod
    def to_python(cls, data: dict[str, Any]) -> Self | None:  # justification: decoded JSON
        values = []
        for index, crumb in enumerate(get_path(data, "values", filter=True, default=())):
            # TODO(ja): Handle already invalid and None breadcrumbs
            values.append(cls.normalize_crumb(crumb))

        return super().to_python({"values": values})

    def to_json(self) -> dict[str, Any]:  # justification: decoded JSON
        return prune_empty_keys(
            {
                "values": [
                    prune_empty_keys(
                        {
                            "type": crumb["type"],
                            "level": crumb["level"],
                            "timestamp": crumb["timestamp"],
                            "message": crumb["message"],
                            "category": crumb["category"],
                            "event_id": crumb["event_id"],
                            "data": crumb["data"] or None,
                        }
                    )
                    for crumb in self.values
                ]
                or None
            }
        )

    @classmethod
    # justification: decoded JSON
    def normalize_crumb(cls, crumb: Mapping[str, Any]) -> dict[str, Any]:
        crumb = dict(crumb)
        ts: datetime | None = parse_timestamp(crumb.get("timestamp"))
        if ts:
            crumb["timestamp"] = ts.timestamp()
        else:
            crumb["timestamp"] = None

        for key in ("type", "level", "message", "category", "event_id", "data"):
            crumb.setdefault(key, None)

        return crumb

    def get_api_context(
        self, is_public: bool = False, platform: str | None = None
    ) -> Mapping[str, Any]:  # justification: decoded JSON
        def _convert(x: Mapping[str, Any]) -> dict[str, Any]:  # justification: decoded JSON
            return {
                "type": x["type"],
                "timestamp": x["timestamp"] and to_datetime(x["timestamp"]),
                "level": x.get("level", "info"),
                "message": x.get("message"),
                "category": x.get("category"),
                "data": x.get("data") or None,
                "event_id": x.get("event_id"),
            }

        return {"values": [_convert(v) for v in self.values]}

    def get_api_meta(
        # justification: decoded JSON
        self,
        meta: Mapping[str, Any],  # justification: decoded JSON
        is_public: bool = False,
        platform: str | None = None,
    ) -> Mapping[str, Any] | None:  # justification: decoded JSON
        if meta and "values" not in meta:
            return {"values": meta}
        else:
            return meta
