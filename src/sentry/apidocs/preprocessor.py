from typing import Dict, Literal, Set, TypedDict


class EndpointRegistryType(TypedDict):
    callback: str
    methods: Set[Literal["GET", "POST", "PUT", "PATCH", "DELETE"]]


PUBLIC_ENDPOINTS: Dict[str, EndpointRegistryType] = {}


def custom_preprocessing_hook(endpoints):  # TODO: organize method, rename
    filtered = []
    for (path, path_regex, method, callback) in endpoints:

        if (
            callback.__name__ in PUBLIC_ENDPOINTS
            and method in PUBLIC_ENDPOINTS[callback.__name__]["methods"]
        ):
            filtered.append((path, path_regex, method, callback))

    return filtered
