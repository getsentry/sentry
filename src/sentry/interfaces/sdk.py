__all__ = ("Sdk",)

from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys


class Sdk(Interface):
    """
    The SDK used to transmit this event.

    >>> {
    >>>     "name": "sentry.java",
    >>>     "version": "1.7.10",
    >>>     "integrations": ["log4j"],
    >>>     "packages": [
    >>>         {
    >>>             "name": "maven:io.sentry.sentry",
    >>>             "version": "1.7.10",
    >>>         }
    >>>     ]
    >>> }
    """

    @classmethod
    def to_python(cls, data):
        for key in ("name", "version", "integrations", "packages"):
            data.setdefault(key, None)

        return cls(**data)

    def to_json(self):
        return prune_empty_keys(
            {
                "name": self.name,
                "version": self.version,
                "integrations": self.integrations or None,
                "packages": self.packages or None,
            }
        )

    def get_api_context(self, is_public=False, platform=None):
        return {"name": self.name, "version": self.version}

    def get_api_meta(self, meta, is_public=False, platform=None):
        return {"": meta.get(""), "name": meta.get("name"), "version": meta.get("version")}
