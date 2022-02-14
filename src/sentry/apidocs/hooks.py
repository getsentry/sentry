from typing import Any, Dict, Literal, Set, TypedDict

from drf_spectacular.plumbing import UnableToProceedError

from sentry.apidocs.build import OPENAPI_TAGS

HTTP_METHODS_SET = Set[
    Literal["GET", "POST", "PUT", "OPTIONS", "HEAD", "DELETE", "TRACE", "CONNECT", "PATCH"]
]


class EndpointRegistryType(TypedDict):
    methods: HTTP_METHODS_SET


PUBLIC_ENDPOINTS: Dict[str, EndpointRegistryType] = {}


defined_tag_set = {t["name"] for t in OPENAPI_TAGS}


def custom_preprocessing_hook(endpoints: Any) -> Any:  # TODO: organize method, rename
    filtered = []
    for (path, path_regex, method, callback) in endpoints:

        if (
            callback.__name__ in PUBLIC_ENDPOINTS
            and method in PUBLIC_ENDPOINTS[callback.__name__]["methods"]
        ):
            filtered.append((path, path_regex, method, callback))

    return filtered


def custom_postprocessing_hook(result: Any, generator: Any, **kwargs: Any) -> Any:
    for path, endpoints in result["paths"].items():
        for method_info in endpoints.values():
            if method_info.get("tags") is None:
                raise UnableToProceedError(
                    f"Please add a single tag to {path}. The list of tags is defined at OPENAPI_TAGS in src/sentry/apidocs/build.py "
                )

            num_of_tags = len(method_info["tags"])

            if num_of_tags > 1:
                raise UnableToProceedError(
                    f"Please add only a single tag to {path}. Right now there are {num_of_tags}."
                )
            for tag in method_info["tags"]:
                if tag not in defined_tag_set:
                    raise UnableToProceedError(
                        f"{tag} is not defined by OPENAPI_TAGS in src/sentry/apidocs/build.py. "
                        "Please use a suitable tag or add a new one to OPENAPI_TAGS"
                    )

    return result
