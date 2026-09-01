from __future__ import annotations

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationsBaseEndpoint,
    can_request_actor_create_investigation,
    investigation_ids_with_project_access,
    service_error,
)
from sentry.investigations.endpoints.validators import InvestigationCandidatesValidator
from sentry.investigations.models import (
    Investigation,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services import (
    investigation_legacy_source_key,
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

        lineage_keys = {
            investigation_lineage_key(template.key, source.source)
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
                Q(lineage_key__in=lineage_keys)
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
        viewable_ids = investigation_ids_with_project_access(
            existing, request.access.accessible_project_ids
        )
        can_create = can_request_actor_create_investigation(request)
        items: list[dict[str, str]] = []
        for source in resolved_sources:
            if source is None:
                items.append({"status": "unavailable"})
                continue
            investigation = existing_by_lineage_key.get(
                investigation_lineage_key(template.key, source.source)
            ) or existing_by_legacy_source_key.get(investigation_legacy_source_key(source.source))
            if investigation is not None:
                if investigation.id in viewable_ids:
                    items.append({"status": "view", "investigationId": str(investigation.id)})
                else:
                    items.append({"status": "unavailable"})
            elif can_create:
                items.append({"status": "investigate"})
            else:
                items.append({"status": "unavailable"})
        return Response({"items": items})
