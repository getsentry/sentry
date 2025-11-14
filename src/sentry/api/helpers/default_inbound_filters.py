from typing import int
from collections.abc import Sequence

from sentry.ingest import inbound_filters
from sentry.models.organization import Organization
from sentry.models.project import Project


# Turns on certain inbound filters by default for project.
def set_default_inbound_filters(
    project: Project,
    organization: Organization,
    filters: Sequence[str] = (
        "browser-extensions",
        "legacy-browsers",
        "web-crawlers",
        "filtered-transaction",
    ),
) -> None:

    browser_subfilters = [
        "ie",
        "firefox",
        "chrome",
        "safari",
        "opera",
        "opera_mini",
        "android",
        "edge",
    ]

    for filter_id in filters:
        state: dict[str, bool | list[str]] = {}
        if filter_id == "legacy-browsers":
            state["subfilters"] = browser_subfilters
        else:
            state["active"] = True

        inbound_filters.set_filter_state(filter_id, project, state)
