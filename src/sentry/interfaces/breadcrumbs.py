__all__ = ("Breadcrumbs",)

from sentry.interfaces.base import Interface
from sentry.utils.dates import parse_timestamp, to_datetime, to_timestamp
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
    def to_python(cls, data, **kwargs):
        values = []
        for index, crumb in enumerate(get_path(data, "values", filter=True, default=())):
            # TODO(ja): Handle already invalid and None breadcrumbs
            values.append(cls.normalize_crumb(crumb))

        return super().to_python({"values": values}, **kwargs)

    def to_json(self):
        """
        :param values:
            A list of :class:`~sentry.interfaces.breadcrumbs.Breadcrumb`.
        """
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
    def normalize_crumb(cls, crumb):
        """
        Normalize a crumb dict.

        :param dict crumb: A raw event from the Sentry API.
        :returns: The normalized crumb.
        """
        crumb = dict(crumb)
        ts = parse_timestamp(crumb.get("timestamp"))
        if ts:
            crumb["timestamp"] = to_timestamp(ts)
        else:
            crumb["timestamp"] = None

        for key in ("type", "level", "message", "category", "event_id", "data"):
            crumb.setdefault(key, None)

        return crumb

    def get_api_context(self, is_public=False, platform=None):
        def _convert(x):
            """
            Convert a log record to a dictionary.

            :param x: A log record as returned by :func:`logging.Logger.makeRecord`.
            :returns: A dictionary with the
            following keys and values (all optional):

                ``type`` (*string*) -- The type of message, e.g., "error" or "warning".

                ``timestamp`` (*datetime*)
            -- The time at which the event occurred; if not specified, defaults to *now*.

                ``level`` (*string*) -- The level of importance for this event; if
            not specified, defaults to "info".  Possible values are "debug", "info", "warning", and finally error.
            """
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

    def get_api_meta(self, meta, is_public=False, platform=None):
        if meta and "values" not in meta:
            return {"values": meta}
        else:
            return meta
