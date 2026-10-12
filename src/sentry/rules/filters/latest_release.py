from __future__ import annotations

from sentry.rules.filters.base import EventFilter


class LatestReleaseFilter(EventFilter):
    id = "sentry.rules.filters.latest_release.LatestReleaseFilter"
    label = "The event is from the latest release"
