import inspect
from typing import Any, Dict, List, Literal, Mapping, Set, Tuple, TypedDict

from more_itertools import take

from sentry.api.api_owners import ApiOwner
from sentry.apidocs.api_ownership_allowlist_dont_modify import API_OWNERSHIP_ALLOWLIST_DONT_MODIFY
from sentry.apidocs.build import OPENAPI_TAGS
from sentry.apidocs.utils import SentryApiBuildError

HTTP_METHODS_SET = Set[
    Literal["GET", "POST", "PUT", "OPTIONS", "HEAD", "DELETE", "TRACE", "CONNECT", "PATCH"]
]


class EndpointRegistryType(TypedDict):
    methods: HTTP_METHODS_SET


PUBLIC_ENDPOINTS: Dict[str, EndpointRegistryType] = {}


_DEFINED_TAG_SET = {t["name"] for t in OPENAPI_TAGS}

# path prefixes to exclude
# this is useful if we're duplicating an endpoint for legacy purposes
# but do not want to document it
EXCLUSION_PATH_PREFIXES = ["/api/0/monitors/"]


def __get_explicit_endpoints() -> List[Tuple[str, str, str, Any]]:
    """
    We have a few endpoints which are wrapped by `method_dispatch`, which DRF
    will ignore (see [0]). To still have these endpoints properly included in
    our docs, we explicitly define them here.

    XXX: This is currently just used for monitors. In the future we'll remove
         the legacy monitor endpoints that require us to have method_dispatch
         and we can probably remove this too.

    [0]: https://github.com/encode/django-rest-framework/blob/3f8ab538c1a7e6f887af9fec41847e2d67ff674f/rest_framework/schemas/generators.py#L117-L118
    """
    from sentry.monitors.endpoints.monitor_ingest_checkin_details import (
        MonitorIngestCheckInDetailsEndpoint,
    )
    from sentry.monitors.endpoints.monitor_ingest_checkin_index import (
        MonitorIngestCheckInIndexEndpoint,
    )
    from sentry.monitors.endpoints.organization_monitor_checkin_index import (
        OrganizationMonitorCheckInIndexEndpoint,
    )

    return [
        (
            "/api/0/organizations/{organization_slug}/monitors/{monitor_slug}/checkins/",
            r"^(?P<organization_slug>[^\/]+)/monitors/(?P<monitor_slug>[^\/]+)/checkins/$",
            "GET",
            OrganizationMonitorCheckInIndexEndpoint.as_view(),
        ),
        (
            "/api/0/organizations/{organization_slug}/monitors/{monitor_slug}/checkins/",
            r"^(?P<organization_slug>[^\/]+)/monitors/(?P<monitor_slug>[^\/]+)/checkins/$",
            "POST",
            MonitorIngestCheckInIndexEndpoint.as_view(),
        ),
        (
            "/api/0/organizations/{organization_slug}/monitors/{monitor_slug}/checkins/{checkin_id}/",
            r"^(?P<organization_slug>[^\/]+)/monitors/(?P<monitor_slug>[^\/]+)/checkins/(?P<checkin_id>[^\/]+)/$",
            "PUT",
            MonitorIngestCheckInDetailsEndpoint.as_view(),
        ),
    ]


def codemod_publish_status(endpoints):
    class_methods = {}
    for (path, path_regex, method, callback) in endpoints:
        view_class = callback.view_class
        if view_class not in class_methods and view_class.publish_status == []:
            class_methods[view_class] = []
        class_methods[view_class].append(method)

    # Not doing a full loop to just generate a few examples
    for (key, value) in take(5, class_methods.items()):
        if len(value) > 0:
            # Read file and find the location you want to add the param to
            class_name = key.__name__
            file_path = inspect.getfile(key)
            # print("file_path", file_path)
            file_to_read = open(file_path)
            current_line = file_to_read.readline()
            previous_lines = [current_line]
            while f"class {class_name}" not in current_line:
                current_line = file_to_read.readline()
                previous_lines.append(current_line)

            next_lines = file_to_read.readlines()
            file_to_read.close()

            # Prepare what you want to write
            content = "    publish_status = [\n"

            for method in value:
                if key.public and method in key.public:
                    content = (
                        content + '        {"' + method + '"' + ": ApiPublishStatus.PUBLIC},\n"
                    )
                elif hasattr(key, "private") and key.private:
                    content = (
                        content + '        {"' + method + '"' + ": ApiPublishStatus.PRIVATE},\n"
                    )
                else:
                    content = (
                        content + '        {"' + method + '"' + ": ApiPublishStatus.UNKNOWN},\n"
                    )
            content = content + "    ]\n"

            # Write new content to file
            file_to_write = open(file_path, "w")
            file_to_write.writelines("from sentry.api.api_publish_status import ApiPublishStatus\n")
            file_to_write.writelines(previous_lines)
            file_to_write.writelines(content)
            file_to_write.writelines(next_lines)

            file_to_write.truncate()
            file_to_write.close()


def custom_preprocessing_hook(endpoints: Any) -> Any:  # TODO: organize method, rename
    filtered = []
    codemod_publish_status(endpoints)
    for (path, path_regex, method, callback) in endpoints:
        if callback.view_class.owner == ApiOwner.UNOWNED:
            if path not in API_OWNERSHIP_ALLOWLIST_DONT_MODIFY:
                raise SentryApiBuildError(
                    f"Endpoint {callback.view_class} is missing the attribute owner: ApiOwner. \n"
                    + "If you can't find your team in ApiOwners feel free to add the associated github group. ",
                )

        if any(path.startswith(p) for p in EXCLUSION_PATH_PREFIXES):
            pass

        elif callback.view_class.public:
            # endpoints that are documented via tooling
            if method in callback.view_class.public:
                # only pass declared public methods of the endpoint
                # to the rest of the OpenAPI build pipeline
                filtered.append((path, path_regex, method, callback))

        else:
            # if an endpoint doesn't have any registered public methods, don't check it.
            pass

    # Register explicit ednpoints
    filtered.extend(__get_explicit_endpoints())

    return filtered


def custom_postprocessing_hook(result: Any, generator: Any, **kwargs: Any) -> Any:
    for path, endpoints in result["paths"].items():
        for method_info in endpoints.values():
            _check_tag(path, method_info)

            if method_info.get("description") is None:
                raise SentryApiBuildError(
                    "Please add a description to your endpoint method via a docstring"
                )
            # ensure path parameters have a description
            for param in method_info.get("parameters", []):
                if param["in"] == "path" and param.get("description") is None:
                    raise SentryApiBuildError(
                        f"Please add a description to your path parameter '{param['name']}'"
                    )

    return result


def _check_tag(path: str, method_info: Mapping[str, Any]) -> None:
    if method_info.get("tags") is None:
        raise SentryApiBuildError(
            f"Please add a single tag to {path}. The list of tags is defined at OPENAPI_TAGS in src/sentry/apidocs/build.py "
        )

    num_of_tags = len(method_info["tags"])

    if num_of_tags > 1:
        raise SentryApiBuildError(
            f"Please add only a single tag to {path}. Right now there are {num_of_tags}."
        )

    tag = method_info["tags"][0]

    if tag not in _DEFINED_TAG_SET:
        raise SentryApiBuildError(
            f"{tag} is not defined by OPENAPI_TAGS in src/sentry/apidocs/build.py. "
            "Please use a suitable tag or add a new one to OPENAPI_TAGS"
        )
