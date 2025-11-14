from typing import int, TypedDict

from sentry.replays.lib.cache import AutoCache


class ProcessorContext(TypedDict):
    has_sent_replays_cache: AutoCache[int, bool] | None
    options_cache: AutoCache[int, tuple[bool, bool]] | None
