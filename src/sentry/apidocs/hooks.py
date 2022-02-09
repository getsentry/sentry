from typing import Any, Dict, Literal, Set, TypedDict

from drf_spectacular.drainage import warn
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
    from sentry.apidocs.registry import EXCLUDED_FROM_PUBLIC_ENDPOINTS, PUBLIC_ENDPOINTS_FROM_JSON

    filtered = []
    for (path, path_regex, method, callback) in endpoints:
        view = f"{callback.__module__}.{callback.__name__}"

        if view in PUBLIC_ENDPOINTS:
            # if the endpoint is registered as public but some methods aren't listed don't error
            if method in PUBLIC_ENDPOINTS[view]["methods"]:
                filtered.append((path, path_regex, method, callback))
        elif view in PUBLIC_ENDPOINTS_FROM_JSON:
            # if the endpoint was documented via openapi JSON don't error
            pass
        elif view in EXCLUDED_FROM_PUBLIC_ENDPOINTS:
            # if the endpoint was previously not documented, don't error
            pass
        else:
            # any new endpoint that isn't documented should recieve this error when building api docs
            warn(
                f"{view} {method} is unnacounted for. "
                "Either document the endpoint or add it to EXCLUDED_FROM_PUBLIC_ENDPOINTS"
                "in src/sentry/apidocs/preprocessor.py.\n"
                "See https://develop.sentry.dev/api/public/ for more info on "
                "making APIs public."
            )

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
