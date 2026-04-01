from collections.abc import Sequence
from typing import Any

from parsimonious.nodes import Node
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


def _format_search_value(value: event_search.SearchValue) -> str:
    if isinstance(value.raw_value, str) and value.is_wildcard():
        return value.raw_value
    return value.to_query_string()


def _get_term_signature(
    filter: event_search.SearchFilter | event_search.AggregateFilter,
) -> tuple[str, str, str, str]:
    return (
        type(filter).__name__,
        filter.key.name,
        filter.operator,
        repr(filter.value.raw_value),
    )


def _flatten_filter_terms(
    tokens: Sequence[event_search.QueryToken],
) -> list[event_search.SearchFilter | event_search.AggregateFilter]:
    flattened: list[event_search.SearchFilter | event_search.AggregateFilter] = []

    for token in tokens:
        if isinstance(token, (event_search.SearchFilter, event_search.AggregateFilter)):
            flattened.append(token)
        elif isinstance(token, event_search.ParenExpression):
            flattened.extend(_flatten_filter_terms(token.children))

    return flattened


def _extract_original_filter_tokens(tree: Node | None) -> list[str]:
    if tree is None:
        return []

    original_tokens: list[str] = []

    def visit(node: Node) -> None:
        if node.expr_name == "filter":
            original_tokens.append(node.text)
            return

        for child in node.children:
            visit(child)

    visit(tree)
    return original_tokens


def _build_original_token_lookup(
    parsed_terms: Sequence[event_search.QueryToken],
    tree: Node | None,
) -> dict[tuple[str, str, str, str], list[str]]:
    flattened_terms = _flatten_filter_terms(parsed_terms)
    original_tokens = _extract_original_filter_tokens(tree)

    if len(flattened_terms) != len(original_tokens):
        return {}

    token_lookup: dict[tuple[str, str, str, str], list[str]] = {}
    for filter, original_token in zip(flattened_terms, original_tokens):
        token_lookup.setdefault(_get_term_signature(filter), []).append(original_token)

    return token_lookup


def _pop_original_token(
    token_lookup: dict[tuple[str, str, str, str], list[str]],
    filter: event_search.SearchFilter | event_search.AggregateFilter,
) -> str | None:
    matching_tokens = token_lookup.get(_get_term_signature(filter))
    if not matching_tokens:
        return None

    return matching_tokens.pop(0)


def _format_token(
    filter: event_search.SearchFilter | event_search.AggregateFilter,
    original_token: str | None = None,
) -> str:
    """Format a filter token as a query string, preserving wildcard operator tokens."""
    if original_token is not None and filter.value.is_wildcard():
        return original_token

    value = _format_search_value(filter.value)
    key_name = filter.key.name

    if isinstance(filter, event_search.SearchFilter):
        if filter.operator == "IN":
            return f"{key_name}:{value}"
        if filter.operator in ("NOT IN", "!="):
            return f"!{key_name}:{value}"

    if filter.operator == "=":
        return f"{key_name}:{value}"

    return f"{key_name}:{filter.operator}{value}"


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
            key_results, query_context, parse_tree, parsed_terms = RPCBase.validate_query(
                query_string,
                snuba_params,
                item_type,
                definitions,
                Referrer.API_TRACE_ITEM_QUERY_VALIDATOR,
            )
        except (InvalidSearchQuery, IncompatibleMetricsQuery) as e:
            return Response({"detail": str(e)}, status=400)

        original_token_lookup = _build_original_token_lookup(parsed_terms, parse_tree)

        filters_response: list[dict[str, Any]] = []
        for sf in query_context.where_terms:
            result = key_results.get(sf.key.name, {"valid": False, "error": "Unknown attribute"})
            entry: dict[str, Any] = {
                "token": _format_token(sf, _pop_original_token(original_token_lookup, sf)),
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
                        "token": _format_token(af, _pop_original_token(original_token_lookup, af)),
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
                    "token": _format_token(af, _pop_original_token(original_token_lookup, af)),
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
