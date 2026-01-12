from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.attributes import OCCURRENCE_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.ourlogs.attributes import OURLOG_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.profile_functions.attributes import PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.spans.attributes import SPAN_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.trace_metrics.attributes import TRACE_METRICS_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.uptime_results.attributes import UPTIME_ATTRIBUTE_DEFINITIONS

VALID_TYPES = frozenset(["spans", "logs", "occurrences", "metrics", "uptime_results", "profiles"])

TYPE_TO_DEFINITIONS = {
    "spans": SPAN_ATTRIBUTE_DEFINITIONS,
    "logs": OURLOG_ATTRIBUTE_DEFINITIONS,
    "occurrences": OCCURRENCE_ATTRIBUTE_DEFINITIONS,
    "metrics": TRACE_METRICS_ATTRIBUTE_DEFINITIONS,
    "uptime_results": UPTIME_ATTRIBUTE_DEFINITIONS,
    "profiles": PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS,
}


@region_silo_endpoint
class OrganizationAttributeMappingsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.EXPLORE

    def get(self, request: Request, organization: Organization) -> Response:
        requested_types = request.GET.getlist("type")

        if requested_types:
            invalid_types = set(requested_types) - VALID_TYPES
            if invalid_types:
                return Response(
                    {"detail": f"Invalid type(s): {', '.join(sorted(invalid_types))}"},
                    status=400,
                )
            types_to_include = list(set(requested_types))
        else:
            types_to_include = list(VALID_TYPES)

        result = []
        for type_name in types_to_include:
            definitions = TYPE_TO_DEFINITIONS[type_name]
            for definition in definitions.values():
                if definition.private:
                    continue

                result.append(
                    {
                        "type": type_name,
                        "publicAlias": definition.public_alias,
                        "internalName": definition.internal_name,
                        "searchType": definition.search_type,
                    }
                )

        return Response({"data": result})
