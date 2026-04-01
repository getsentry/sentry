from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

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
            return Response({"attributes": []})

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

        response_data: list[dict[str, object]] = []
        seen_attributes: set[tuple[str, str | None]] = set()

        def append_result(key: str, valid: bool, attribute_type: str | None) -> None:
            dedupe_key = (key, attribute_type)
            if dedupe_key in seen_attributes:
                return

            seen_attributes.add(dedupe_key)
            response_data.append(
                {
                    "key": key,
                    "valid": valid,
                    "type": attribute_type if valid else None,
                }
            )

        for sf in query_context.where_terms:
            result = key_results.get(sf.key.name, {"valid": False, "error": "Unknown attribute"})
            append_result(
                sf.key.name,
                result["valid"],
                result.get("type") if result["valid"] else None,
            )

        for af in query_context.having_terms:
            func_keys = _extract_function_keys(af)
            if not func_keys:
                continue

            all_valid = True
            for key in func_keys:
                result = key_results.get(key, {"valid": False, "error": "Unknown attribute"})
                if not result["valid"]:
                    all_valid = False

            primary_result = key_results.get(func_keys[0], {})
            append_result(
                func_keys[0],
                all_valid,
                primary_result.get("type") if all_valid else None,
            )

        return Response({"attributes": response_data})
