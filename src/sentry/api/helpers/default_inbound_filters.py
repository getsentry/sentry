from typing import Dict, List, Union

from sentry.ingest import inbound_filters


# Turns on certain inbound filters by default for project.
def set_default_inbound_filters(project):
    filters = [
        "browser-extensions",
        "legacy-browsers",
        "web-crawlers",
        "filtered-transaction",
    ]

    for filter_id in filters:
        state: Dict[str, Union[bool, List[str]]] = {}
        if filter_id == "legacy-browsers":
            state["subfilters"] = [
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
            state["active"] = True

        inbound_filters.set_filter_state(filter_id, project, state)
