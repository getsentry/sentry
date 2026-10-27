from __future__ import annotations

from django.db.models import Q
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationsBaseEndpoint,
    can_request_actor_create_investigation,
    organization_project_ids,
    service_error,
)
from sentry.investigations.endpoints.serializers import (
    orchestration_summaries_by_investigation,
)
from sentry.investigations.endpoints.serializers.responses import (
    InvestigationCandidateResponse,
    InvestigationCandidatesResponse,
)
from sentry.investigations.endpoints.validators import InvestigationCandidatesValidator
from sentry.investigations.models import (
    Investigation,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services import (
    agentic_breached_metric_lineage_key,
    investigation_legacy_source_key,
    investigation_lineage_key,
    resolve_investigation_sources,
)
from sentry.investigations.templates import get_investigation_template
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCandidatesEndpoint(OrganizationInvestigationsBaseEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Resolve Investigation Candidates",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=InvestigationCandidatesValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationCandidatesResponse", InvestigationCandidatesResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={
                    "templateKey": "breached_metric",
                    "templateVersion": 1,
                    "sources": [
                        {"type": "metric_open_period", "ref": {"groupId": 1, "openPeriodId": 2}}
                    ],
                },
                request_only=True,
            )
        ],
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Internal UI lookup. Resolve metric_open_period sources for the supplied templateKey
        and templateVersion in input order. Each item has
        status view (with investigationId and optionally orchestration), investigate, or
        unavailable. Missing or inaccessible sources are unavailable. Requires the
        organizations:investigations feature and open organization membership.
        """
        validator = InvestigationCandidatesValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = validator.validated_data
        template = get_investigation_template(values["template_key"], values["template_version"])
        if template is None:
            return Response(
                {"detail": "Unknown investigation template or version."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sources = values["sources"]
        if any(source.get("type") != template.source_type for source in sources):
            return Response(
                {"detail": "Source type does not match the template."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            resolved_sources = resolve_investigation_sources(
                organization=organization,
                sources=sources,
                accessible_project_ids=organization_project_ids(organization),
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        lineage_keys = {
            investigation_lineage_key(template.key, source.source)
            for source in resolved_sources
            if source is not None
        }
        agentic_lineage_keys = {
            agentic_breached_metric_lineage_key(source.source)
            for source in resolved_sources
            if source is not None
        }
        legacy_source_keys = {
            investigation_legacy_source_key(source.source)
            for source in resolved_sources
            if source is not None
        }
        existing = list(
            Investigation.objects.filter(
                organization=organization,
                status=InvestigationStatus.ACTIVE,
            ).filter(
                Q(lineage_key__in=lineage_keys | agentic_lineage_keys)
                | Q(
                    template_key=template.key,
                    source_type=InvestigationSourceType.BREACHED_METRIC,
                    source_key__in=legacy_source_keys,
                )
            )
        )
        existing_by_lineage_key = {
            investigation.lineage_key: investigation
            for investigation in existing
            if investigation.lineage_key is not None
        }
        existing_by_legacy_source_key = {
            investigation.source_key: investigation
            for investigation in existing
            if investigation.source_key is not None
        }
        orchestration_by_investigation = orchestration_summaries_by_investigation(existing)
        can_create = can_request_actor_create_investigation(request)
        items: list[InvestigationCandidateResponse] = []
        for source in resolved_sources:
            if source is None:
                items.append({"status": "unavailable"})
                continue
            investigation = (
                existing_by_lineage_key.get(agentic_breached_metric_lineage_key(source.source))
                or existing_by_lineage_key.get(
                    investigation_lineage_key(template.key, source.source)
                )
                or existing_by_legacy_source_key.get(investigation_legacy_source_key(source.source))
            )
            if investigation is not None:
                item: InvestigationCandidateResponse = {
                    "status": "view",
                    "investigationId": str(investigation.id),
                }
                orchestration = orchestration_by_investigation.get(investigation.id)
                if orchestration is not None:
                    item["orchestration"] = orchestration
                items.append(item)
            elif can_create:
                items.append({"status": "investigate"})
            else:
                items.append({"status": "unavailable"})
        response_data: InvestigationCandidatesResponse = {"items": items}
        return Response(response_data)
