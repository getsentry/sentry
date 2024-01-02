import json  # noqa: S003
import os
import re
from collections import OrderedDict
from typing import Any, Dict, List, Literal, Mapping, Set, Tuple, TypedDict

from drf_spectacular.generators import EndpointEnumerator, SchemaGenerator

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.apidocs.api_ownership_allowlist_dont_modify import API_OWNERSHIP_ALLOWLIST_DONT_MODIFY
from sentry.apidocs.api_publish_status_allowlist_dont_modify import (
    API_PUBLISH_STATUS_ALLOWLIST_DONT_MODIFY,
)
from sentry.apidocs.build import OPENAPI_TAGS
from sentry.apidocs.utils import SentryApiBuildError

HTTP_METHOD_NAME = Literal[
    "GET", "POST", "PUT", "OPTIONS", "HEAD", "DELETE", "TRACE", "CONNECT", "PATCH"
]
HTTP_METHODS_SET = Set[HTTP_METHOD_NAME]


class EndpointRegistryType(TypedDict):
    methods: HTTP_METHODS_SET


PUBLIC_ENDPOINTS: Dict[str, EndpointRegistryType] = {}

_DEFINED_TAG_SET = {t["name"] for t in OPENAPI_TAGS}
_OWNERSHIP_FILE = "api_ownership_stats_dont_modify.json"

# path prefixes to exclude
# this is useful if we're duplicating an endpoint for legacy purposes
# but do not want to document it
EXCLUSION_PATH_PREFIXES = [
    "/api/0/monitors/",
    # Issue URLS have an expression of group|issue that resolves to `var`
    "/api/0/{var}/{issue_id}/",
]


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


def __get_line_count_for_team_stats(team_stats: Mapping):
    """
    Returns number of lines it takes to write ownership for each team.
    For example returns 7 for:
    enterprise: {
        block_start: {line_number_for_enterprise},
        public=[ExamplePublicEndpoint::GET],
        private=[ExamplePrivateEndpoint::GET],
        experimental=[ExampleExperimentalEndpoint::GET],
        unknown=[ExampleUnknownEndpoint::GET]
    }
    """

    # Add 3 lines for team name, block_start and }
    line_count = 3
    for group in team_stats:
        if len(team_stats[group]) == 0:
            line_count += 1
        else:
            line_count += len(team_stats[group]) + 2
    return line_count


def __write_ownership_data(ownership_data: Dict[ApiOwner, Dict]):
    """
    Writes API ownership for all the teams in _OWNERSHIP_FILE.
    This file is used by Sentaur slack bot to inform teams on status of their APIs
    """
    processed_data = {}
    index = 2
    for team in ownership_data:
        # sorting APIs list so it doesn't trigger file change on every commit
        processed_data[team.value] = {
            "block_start": index,
            ApiPublishStatus.PUBLIC.value: sorted(ownership_data[team][ApiPublishStatus.PUBLIC]),
            ApiPublishStatus.PRIVATE.value: sorted(ownership_data[team][ApiPublishStatus.PRIVATE]),
            ApiPublishStatus.EXPERIMENTAL.value: sorted(
                ownership_data[team][ApiPublishStatus.EXPERIMENTAL]
            ),
            ApiPublishStatus.UNKNOWN.value: sorted(
                ownership_data[team][ApiPublishStatus.EXPERIMENTAL.UNKNOWN]
            ),
        }
        index += __get_line_count_for_team_stats(ownership_data[team])
    dir = os.path.dirname(os.path.realpath(__file__))
    file_to_write = open(f"{dir}/{_OWNERSHIP_FILE}", "w")
    file_to_write.writelines(json.dumps(processed_data, indent=4))
    file_to_write.write("\n")
    file_to_write.close()


class CustomEndpointEnumerator(EndpointEnumerator):
    _non_capturing = re.compile(r"\(\?:[a-z-]+\|[a-z-]+\)")

    def get_path_from_regex(self, path_regex: str) -> str:
        # django 4.x changes to simplify_regex breaks these urls
        path_regex = self._non_capturing.sub("{var}", path_regex)
        return super().get_path_from_regex(path_regex)


class CustomGenerator(SchemaGenerator):
    endpoint_inspector_cls = CustomEndpointEnumerator


def custom_preprocessing_hook(endpoints: Any) -> Any:  # TODO: organize method, rename
    filtered = []
    ownership_data: Dict[ApiOwner, Dict] = {}
    for (path, path_regex, method, callback) in endpoints:
        owner_team = callback.view_class.owner
        if owner_team not in ownership_data:
            ownership_data[owner_team] = {
                ApiPublishStatus.UNKNOWN: set(),
                ApiPublishStatus.PUBLIC: set(),
                ApiPublishStatus.PRIVATE: set(),
                ApiPublishStatus.EXPERIMENTAL: set(),
            }

        # Fail if endpoint is unowned
        if owner_team == ApiOwner.UNOWNED:
            if path not in API_OWNERSHIP_ALLOWLIST_DONT_MODIFY:
                raise SentryApiBuildError(
                    f"Endpoint {callback.view_class} is missing the attribute owner: ApiOwner. \n"
                    + "If you can't find your team in ApiOwners feel free to add the associated github group. ",
                )

        # Fail if method is not included in publish_status or has unknown status
        if (
            method not in callback.view_class.publish_status
            or callback.view_class.publish_status[method] is ApiPublishStatus.UNKNOWN
        ):
            if (
                path not in API_PUBLISH_STATUS_ALLOWLIST_DONT_MODIFY
                or method not in API_PUBLISH_STATUS_ALLOWLIST_DONT_MODIFY[path]
            ):
                raise SentryApiBuildError(
                    f"All methods must have a known publish_status. Please add a valid publish status for Endpoint {callback.view_class} {method} method.",
                )

        if any(path.startswith(p) for p in EXCLUSION_PATH_PREFIXES):
            pass

        elif callback.view_class.publish_status:
            # endpoints that are documented via tooling
            if (
                method in callback.view_class.publish_status
                and callback.view_class.publish_status[method] is ApiPublishStatus.PUBLIC
            ):
                # only pass declared public methods of the endpoint
                # to the rest of the OpenAPI build pipeline
                filtered.append((path, path_regex, method, callback))

        else:
            # if an endpoint doesn't have any registered public methods, don't check it.
            pass

        ownership_data[owner_team][callback.view_class.publish_status[method]].add(
            f"{callback.view_class.__name__}::{method}"
        )

    __write_ownership_data(ownership_data)
    # Register explicit ednpoints
    filtered.extend(__get_explicit_endpoints())
    return filtered


def dereference_schema(schema: dict, schema_components: dict) -> dict:
    """
    Dereferences the schema reference if it exists. Otherwise, returns the schema as is.
    """
    if len(schema) == 1 and "$ref" in schema:
        # The reference always takes the form of #/components/schemas/{schema_name}
        schema_name = schema["$ref"].split("/")[-1]
        schema = schema_components[schema_name]
    return schema


def custom_postprocessing_hook(result: Any, generator: Any, **kwargs: Any) -> Any:
    # Fetch schema component references
    schema_components = result["components"]["schemas"]

    for path, endpoints in result["paths"].items():
        for method_info in endpoints.values():
            _check_tag(path, method_info)
            endpoint_name = f"'{method_info['operationId']}'"

            if method_info.get("description") is None:
                raise SentryApiBuildError(
                    f"Please add a description via docstring to your endpoint {endpoint_name}"
                )

            for param in method_info.get("parameters", []):
                # Ensure path parameters have a description
                if param["in"] == "path" and param.get("description") is None:
                    raise SentryApiBuildError(
                        f"Please add a description to your path parameter '{param['name']}' for endpoint {endpoint_name}"
                    )

            # Ensure body parameters are sorted by placing required parameters first
            if "requestBody" in method_info:
                try:
                    content = method_info["requestBody"]["content"]
                    # media type can either "multipart/form-data" or "application/json"
                    if "multipart/form-data" in content:
                        schema = content["multipart/form-data"]["schema"]
                    else:
                        schema = content["application/json"]["schema"]

                    # Dereference schema if needed
                    schema = dereference_schema(schema, schema_components)

                    for body_param, param_data in schema["properties"].items():
                        # Ensure body parameters have a description. Our API docs don't
                        # display body params without a description, so it's easy to miss them.
                        # We should be explicitly excluding them as better
                        # practice however.

                        # There is an edge case where a body param might be
                        # reference that we should ignore for now
                        if "description" not in param_data and "$ref" not in param_data:
                            raise SentryApiBuildError(
                                f"""Body parameter '{body_param}' is missing a description for endpoint {endpoint_name}. You can either:
                            1. Add a 'help_text' kwarg to the serializer field
                            2. Remove the field if you're using an inline_serializer
                            3. For a DRF serializer, you must explicitly exclude this field by decorating the request serializer with
                            @extend_schema_serializer(exclude_fields=[{body_param}])."""
                            )

                    # Required params are stored in a list and not in the param itself
                    required = set(schema.get("required", []))
                    if required:
                        # Explicitly sort body params by converting the dict to an ordered dict
                        schema["properties"] = OrderedDict(
                            sorted(
                                schema["properties"].items(),
                                key=lambda param: 0 if param[0] in required else 1,
                            )
                        )
                except KeyError as e:
                    raise SentryApiBuildError(
                        f"Unable to parse body parameters due to KeyError {e} for endpoint {endpoint_name}. Please post in #discuss-apis to fix."
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
