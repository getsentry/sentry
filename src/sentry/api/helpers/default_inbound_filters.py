from sentry import features
from sentry.ingest import inbound_filters


# Turns on certain inbound filters by default for project.
def set_default_inbound_filters(
    project,
    organization,
    filters=(
        "browser-extensions",
        "legacy-browsers",
        "web-crawlers",
        "filtered-transaction",
    ),
):
    if features.has("organizations:legacy-browser-update", organization):
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
    else:
        browser_subfilters = [
            "ie_pre_9",
            "ie9",
            "ie10",
            "ie11",
            "safari_pre_6",
            "opera_pre_15",
            "opera_mini_pre_8",
            "android_pre_4",
            "edge_pre_79",
        ]

    for filter_id in filters:
        state: dict[str, bool | list[str]] = {}
        if filter_id == "legacy-browsers":
            state["subfilters"] = browser_subfilters
        else:
            state["active"] = True

        inbound_filters.set_filter_state(filter_id, project, state)
