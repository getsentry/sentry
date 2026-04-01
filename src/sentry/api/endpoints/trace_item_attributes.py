from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api import event_search
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointBase,
    get_column_definitions,
)
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.eap.types import SupportedTraceItemType
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import RPCBase, _extract_function_keys


class OrganizationTraceItemQueryValidatorSerializer(serializers.Serializer):
    itemType = serializers.ChoiceField(
        [e.value for e in SupportedTraceItemType], required=True, source="item_type"
    )
    query = serializers.CharField(required=True, max_length=4096)


def _format_token(
    filter: event_search.SearchFilter | event_search.AggregateFilter,
) -> str:
    """Format a filter token as a query string, omitting the redundant '=' operator."""
    token = filter.to_query_string()
    key_name = filter.key.name
    prefix = f"{key_name}:="
    if token.startswith(prefix):
        return f"{key_name}:{token[len(prefix) :]}"
    return token


@cell_silo_endpoint
class OrganizationTraceItemQueryValidatorEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        serializer = OrganizationTraceItemQueryValidatorSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        item_type = SupportedTraceItemType(serializer.validated_data["item_type"])
        query_string: str = serializer.validated_data["query"]

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"filters": [], "functions": []})

        try:
            definitions = get_column_definitions(item_type)
        except ValueError:
            return Response({"detail": f"Unsupported item type: {item_type.value}"}, status=400)
        try:
            key_results, query_context = RPCBase.validate_query(
                query_string,
                snuba_params,
                item_type,
                definitions,
                Referrer.API_TRACE_ITEM_QUERY_VALIDATOR,
            )
        except (InvalidSearchQuery, IncompatibleMetricsQuery) as e:
            return Response({"detail": str(e)}, status=400)

        filters_response: list[dict[str, Any]] = []
        for sf in query_context.where_terms:
            result = key_results.get(sf.key.name, {"valid": False, "error": "Unknown attribute"})
            entry: dict[str, Any] = {
                "token": _format_token(sf),
                "key": sf.key.name,
                "valid": result["valid"],
            }
            if result["valid"]:
                entry["type"] = result["type"]
            else:
                entry["error"] = result.get("error", "Unknown attribute")
            filters_response.append(entry)

        functions_response: list[dict[str, Any]] = []
        for af in query_context.having_terms:
            func_keys = _extract_function_keys(af)
            if not func_keys:
                functions_response.append(
                    {
                        "token": _format_token(af),
                        "key": None,
                        "valid": True,
                        "type": None,
                    }
                )
            else:
                all_valid = True
                first_error = None
                for key in func_keys:
                    result = key_results.get(key, {"valid": False, "error": "Unknown attribute"})
                    if not result["valid"]:
                        all_valid = False
                        if first_error is None:
                            first_error = result.get("error", "Unknown attribute")

                entry = {
                    "token": _format_token(af),
                    "key": func_keys[0],
                    "valid": all_valid,
                }
                if all_valid:
                    primary_result = key_results.get(func_keys[0], {})
                    entry["type"] = primary_result.get("type")
                else:
                    entry["error"] = first_error
                functions_response.append(entry)

        return Response({"filters": filters_response, "functions": functions_response})
