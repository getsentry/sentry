from typing import Any

import orjson

from sentry.attachments import CachedAttachment, attachment_cache
from sentry.ingest.consumer.processors import CACHE_TIMEOUT
from sentry.utils.cache import cache_key_for_event


class ViewHierarchies:
    def __init__(self, data: Any):
        self._cache_key = cache_key_for_event(data)
        self._view_hierarchies: list[tuple[CachedAttachment, Any]] = []
        self._other_attachments: list[CachedAttachment] = []

        for attachment in attachment_cache.get(self._cache_key):
            if attachment.type == "event.view_hierarchy":
                view_hierarchy = orjson.loads(attachment.data)
                self._view_hierarchies.append((attachment, view_hierarchy))
            else:
                self._other_attachments.append(attachment)

    def get_window_class_names(self) -> list[str]:
        """
        Returns the class names of all windows in all view hierarchies.
        """
        windows_to_deobfuscate = []
        for _, view_hierarchy in self._view_hierarchies:
            windows_to_deobfuscate.extend(view_hierarchy.get("windows"))

        class_names = []
        while windows_to_deobfuscate:
            window = windows_to_deobfuscate.pop()
            if window.get("type") is not None:
                class_names.append(window["type"])
            if children := window.get("children"):
                windows_to_deobfuscate.extend(children)

        return class_names

    def deobfuscate_and_save(self, class_names: dict[str, str]):
        """
        Deobfuscates all view hierarchies in-place and persists any changes made.
        """
        if not self._view_hierarchies:
            return

        new_attachments: list[CachedAttachment] = []
        for attachment, view_hierarchy in self._view_hierarchies:
            _deobfuscate_view_hierarchy(view_hierarchy, class_names)
            new_attachments.append(
                CachedAttachment(
                    type=attachment.type,
                    id=attachment.id,
                    name=attachment.name,
                    content_type=attachment.content_type,
                    data=orjson.dumps(view_hierarchy),
                    chunks=None,
                )
            )

        attachments = self._other_attachments + new_attachments
        attachment_cache.set(self._cache_key, attachments, timeout=CACHE_TIMEOUT)


def _deobfuscate_view_hierarchy(view_hierarchy: Any, class_names: dict[str, str]):
    """
    Deobfuscates a view hierarchy in-place.

    The `class_names` dict is used to resolve obfuscated to deobfuscated names. If
    an obfuscated class name isn't present in `class_names`, it is left unchanged.
    """
    windows_to_deobfuscate = list(view_hierarchy.get("windows"))
    while windows_to_deobfuscate:
        window = windows_to_deobfuscate.pop()
        if (
            window.get("type") is not None
            and (mapped_type := class_names.get(window["type"])) is not None
        ):
            window["type"] = mapped_type
        if children := window.get("children"):
            windows_to_deobfuscate.extend(children)
