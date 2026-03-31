from collections.abc import Sequence
from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.api import event_search
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointBase,
    _check_attributes_exist,
    get_column_definitions,
    serialize_type,
)
from sentry.api.utils import handle_query_errors
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.events import fields
from sentry.snuba.referrer import Referrer


class OrganizationTraceItemQueryValidatorSerializer(serializers.Serializer):
    itemType = serializers.ChoiceField(
        [e.value for e in SupportedTraceItemType], required=True, source="item_type"
    )
    query = serializers.CharField(required=True, max_length=4096)


def _extract_tokens(
    terms: Sequence[event_search.QueryToken],
) -> tuple[list[event_search.SearchFilter], list[event_search.AggregateFilter]]:
    """Recursively walk parsed terms and collect SearchFilter and AggregateFilter tokens."""
    search_filters: list[event_search.SearchFilter] = []
    aggregate_filters: list[event_search.AggregateFilter] = []
    for term in terms:
        if isinstance(term, event_search.SearchFilter):
            search_filters.append(term)
        elif isinstance(term, event_search.AggregateFilter):
            aggregate_filters.append(term)
        elif isinstance(term, event_search.ParenExpression):
            nested_search, nested_agg = _extract_tokens(term.children)
            search_filters.extend(nested_search)
            aggregate_filters.extend(nested_agg)
    return search_filters, aggregate_filters


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


def _extract_function_keys(aggregate_filter: event_search.AggregateFilter) -> list[str]:
    """Extract attribute keys from an aggregate function's arguments.

    Returns attribute key names, filtering out literals (numbers, quoted strings).
    Returns an empty list for no-arg functions like count().
    """
    match = fields.is_function(aggregate_filter.key.name)
    if match is None:
        return []
    arguments = fields.parse_arguments(match.group("function"), match.group("columns"))
    keys: list[str] = []
    for arg in arguments:
        # Skip quoted strings
        if (arg.startswith('"') and arg.endswith('"')) or (
            arg.startswith("'") and arg.endswith("'")
        ):
            continue
        # Skip numeric literals
        try:
            float(arg)
            continue
        except ValueError:
            pass
        keys.append(arg)
    return keys


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

        resolver = SearchResolver(
            params=snuba_params,
            config=SearchResolverConfig(),
            definitions=definitions,
        )

        # Step 1: Parse the query
        try:
            parsed_terms = event_search.parse_search_query(
                query_string,
                config=event_search.SearchConfig.create_from(
                    event_search.default_config,
                    wildcard_free_text=True,
                ),
                params=snuba_params.filter_params,
            )
        except (InvalidSearchQuery, IncompatibleMetricsQuery) as e:
            return Response({"detail": str(e)}, status=400)

        # Step 2: Extract tokens
        search_filters, aggregate_filters = _extract_tokens(parsed_terms)

        # Step 3: Collect all unique attribute keys and resolve them
        # Maps key name -> resolution result: (resolved, is_known) or error string
        key_results: dict[str, dict[str, Any]] = {}
        unknown_attrs: list[tuple[str, Any]] = []

        # Collect all keys to validate
        all_keys: set[str] = set()
        for sf in search_filters:
            all_keys.add(sf.key.name)
        for af in aggregate_filters:
            for key in _extract_function_keys(af):
                all_keys.add(key)

        # Resolve each unique key
        for key_name in all_keys:
            try:
                resolved, _context = resolver.resolve_attribute(key_name)
                if key_name in definitions.contexts or key_name in definitions.columns:
                    key_results[key_name] = {
                        "valid": True,
                        "type": serialize_type(resolved.search_type),
                    }
                else:
                    unknown_attrs.append((key_name, resolved))
            except InvalidSearchQuery as e:
                key_results[key_name] = {
                    "valid": False,
                    "error": str(e),
                }

        # Step 4: Batch-check unknown keys against storage
        if unknown_attrs:
            attrs_by_type: dict[AttributeKey.Type.ValueType, list[str]] = {}
            for _, resolved in unknown_attrs:
                attrs_by_type.setdefault(resolved.proto_type, []).append(resolved.internal_name)
            with handle_query_errors():
                existing = _check_attributes_exist(
                    resolver,
                    item_type,
                    attrs_by_type,
                    referrer=Referrer.API_TRACE_ITEM_QUERY_VALIDATOR,
                )

            for key_name, resolved in unknown_attrs:
                if (resolved.proto_type, resolved.internal_name) in existing:
                    key_results[key_name] = {
                        "valid": True,
                        "type": serialize_type(resolved.search_type),
                    }
                else:
                    key_results[key_name] = {
                        "valid": False,
                        "error": f"Unknown attribute: {key_name}",
                    }

        # Step 5: Build per-token response
        filters_response: list[dict[str, Any]] = []
        for sf in search_filters:
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
        for af in aggregate_filters:
            func_keys = _extract_function_keys(af)
            if not func_keys:
                # No-arg function like count()
                functions_response.append(
                    {
                        "token": _format_token(af),
                        "key": None,
                        "valid": True,
                        "type": None,
                    }
                )
            else:
                # Validate all argument keys — function is valid only if all keys are valid
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
