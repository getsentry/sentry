from typing import Dict, List, Union

from sentry.ingest import inbound_filters


# Turns on certain inbound filters by default for project.
def set_default_inbound_filters(project):
    state: Dict[str, Union[bool, List[str]]] = {}
    filters = [
        "browser-extensions",
        "legacy-browsers",
        "web-crawlers",
        "filtered-transaction",
    ]

    for filter_id in filters:
        if filter_id == "legacy-browsers":
            state["subfilters"] = [
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
        else:
            state["active"] = True

        inbound_filters.set_filter_state(filter_id, project, state)
