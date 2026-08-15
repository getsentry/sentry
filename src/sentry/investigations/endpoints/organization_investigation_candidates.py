from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationsBaseEndpoint,
    service_error,
)
from sentry.investigations.endpoints.validators import InvestigationCandidatesValidator
from sentry.investigations.models import Investigation, InvestigationStatus
from sentry.investigations.services import (
    investigation_lineage_key,
    resolve_investigation_sources,
)
from sentry.investigations.templates import get_investigation_template
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCandidatesEndpoint(OrganizationInvestigationsBaseEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
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
                accessible_project_ids=request.access.accessible_project_ids,
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        lineage_keys = [
            investigation_lineage_key(template.key, source.source)
            for source in resolved_sources
            if source is not None
        ]
        existing = {
            investigation.lineage_key: investigation
            for investigation in Investigation.objects.filter(
                organization=organization,
                lineage_key__in=lineage_keys,
                status=InvestigationStatus.ACTIVE,
            )
        }
        can_create = request.user.is_authenticated and not request.user.is_sentry_app
        items: list[dict[str, str]] = []
        for source in resolved_sources:
            if source is None:
                items.append({"status": "unavailable"})
                continue
            investigation = existing.get(investigation_lineage_key(template.key, source.source))
            if investigation is not None:
                items.append({"status": "view", "investigationId": str(investigation.id)})
            elif can_create:
                items.append({"status": "investigate"})
            else:
                items.append({"status": "unavailable"})
        return Response({"items": items})
