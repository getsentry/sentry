import json  # noqa: S003
import os
import re
from collections import OrderedDict
from collections.abc import Mapping
from typing import Any, Literal, TypedDict

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
HTTP_METHODS_SET = set[HTTP_METHOD_NAME]


class EndpointRegistryType(TypedDict):
    methods: HTTP_METHODS_SET


PUBLIC_ENDPOINTS: dict[str, EndpointRegistryType] = {}

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


def __write_ownership_data(ownership_data: dict[ApiOwner, dict]):
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
    ownership_data: dict[ApiOwner, dict] = {}
    for path, path_regex, method, callback in endpoints:
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
    return filtered


def dereference_schema(
    schema: Mapping[str, Any],
    schema_components: Mapping[str, Any],
) -> Mapping[str, Any]:
    """
    Dereferences the schema reference if it exists. Otherwise, returns the schema as is.
    """
    if len(schema) == 1 and "$ref" in schema:
        # The reference always takes the form of #/components/schemas/{schema_name}
        schema_name = schema["$ref"].split("/")[-1]
        schema = schema_components[schema_name]
    return schema


def _validate_request_body(
    request_body: Mapping[str, Any], schema_components: Mapping[str, Any], endpoint_name: str
) -> None:
    """
    1. Dereferences schema if needed.
    2. Requires all body parameters to have a description.
    3. Ensures body parameters are sorted by placing required parameters first.
    """
    content = request_body["content"]
    # media type can either "multipart/form-data" or "application/json"
    if "multipart/form-data" in content:
        schema = content["multipart/form-data"]["schema"]
    else:
        schema = content["application/json"]["schema"]

    # Dereference schema if needed and raise error on schema component collisions
    schema = dereference_schema(schema, schema_components)

    for body_param, param_data in schema["properties"].items():
        # Ensure body parameters have a description. Our API docs don't
        # display body params without a description, so it's easy to miss them.
        # We should be explicitly excluding them as better practice however.

        # There is an edge case where a body param might be reference that we should ignore for now
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


def custom_postprocessing_hook(result: Any, generator: Any, **kwargs: Any) -> Any:
    _fix_issue_paths(result)

    # Fetch schema component references
    schema_components = result["components"]["schemas"]

    for path, endpoints in result["paths"].items():
        for method_info in endpoints.values():
            endpoint_name = f"'{method_info['operationId']}'"

            _check_tag(method_info, endpoint_name)
            _check_description(
                method_info,
                f"Please add a description to your endpoint {endpoint_name} via docstring",
            )

            # Ensure path parameters have a description
            for param in method_info.get("parameters", []):
                if param["in"] == "path":
                    _check_description(
                        param,
                        f"Please add a description to your path parameter '{param['name']}' for endpoint {endpoint_name}",
                    )

            try:
                requestBody = method_info.get("requestBody")
                if requestBody is not None:
                    _validate_request_body(requestBody, schema_components, endpoint_name)
            except KeyError as e:
                raise SentryApiBuildError(
                    f"Unable to parse body parameters due to KeyError {e} for endpoint {endpoint_name}. Please post in #discuss-api to fix."
                )
    return result


def _check_tag(method_info: Mapping[str, Any], endpoint_name: str) -> None:
    if method_info.get("tags") is None:
        raise SentryApiBuildError(
            f"Please add a single tag to {endpoint_name}. The list of tags is defined at OPENAPI_TAGS in src/sentry/apidocs/build.py "
        )

    num_of_tags = len(method_info["tags"])

    if num_of_tags > 1:
        raise SentryApiBuildError(
            f"Please add only a single tag to {endpoint_name}. Right now there are {num_of_tags}."
        )

    tag = method_info["tags"][0]

    if tag not in _DEFINED_TAG_SET:
        raise SentryApiBuildError(
            f"""{tag} is not defined by OPENAPI_TAGS in src/sentry/apidocs/build.py for {endpoint_name}.
            Please use a suitable tag or add a new one to OPENAPI_TAGS"""
        )


def _check_description(json_body: Mapping[str, Any], err_str: str) -> None:
    if json_body.get("description") is None:
        raise SentryApiBuildError(err_str)


def _fix_issue_paths(result: Any) -> Any:
    """
    The way we define `/issues/` paths causes some problems with drf-spectacular:
    - The path may be defined twice, with `/organizations/{organization_id_slug}` prefix and
      without. We want to use the `/organizations` prefixed path as it works across regions.
    - The `/issues/` part of the path is defined as `issues|groups` for compatibility reasons,
      but we only want to use `issues` in the docs

    This function removes duplicate paths, removes the `issues|groups` path parameter and
    replaces it with `issues` in the path.
    """
    items = list(result["paths"].items())

    modified_paths = []

    for path, endpoint in items:
        if "{var}/{issue_id}" in path:
            modified_paths.append(path)

    for path in modified_paths:
        updated_path = path.replace("{var}/{issue_id}", "issues/{issue_id}")
        if path.startswith("/api/0/issues/"):
            updated_path = updated_path.replace(
                "/api/0/issues/", "/api/0/organizations/{organization_id_or_slug}/issues/"
            )
        endpoint = result["paths"][path]
        for method in endpoint.keys():
            endpoint[method]["parameters"] = [
                param
                for param in endpoint[method]["parameters"]
                if not (
                    param["in"] == "path" and param["name"] in ("var", "organization_id_or_slug")
                )
            ]
        result["paths"][updated_path] = endpoint
        del result["paths"][path]
