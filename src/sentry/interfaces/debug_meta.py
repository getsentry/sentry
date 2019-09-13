from __future__ import absolute_import

__all__ = ("DebugMeta",)

from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys


class DebugMeta(Interface):
    """
    Holds debug meta information for processing stacktraces
    and similar things.  This information is deleted after event processing.

    Currently two attributes exist:

    ``sdk_info``:
        sets the SDK that is used for the system.  This affects the lookup
        for system symbols.  If not defined, system symbols are not looked up.
    ``images``:
        a list of debug images and their mappings.
    """

    ephemeral = False
    path = "debug_meta"
    external_type = "debugmeta"

    @classmethod
    def to_python(cls, data):
        return cls(
            images=data.get("images", None) or [],
            sdk_info=data.get("sdk_info"),
            is_debug_build=data.get("is_debug_build"),
        )

    def to_json(self):
        return prune_empty_keys(
            {
                "images": self.images or None,
                "sdk_info": self.sdk_info or None,
                "is_debug_build": self.is_debug_build,
            }
        )
