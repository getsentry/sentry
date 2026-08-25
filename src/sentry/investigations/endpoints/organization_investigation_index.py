from __future__ import annotations

from django.db import router, transaction
from django.db.models import Exists, OuterRef, Q
from django.db.models.functions import Coalesce
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationsBaseEndpoint,
    require_authenticated_user,
    require_investigation_project_access,
    service_error,
    user_id,
)
from sentry.investigations.endpoints.serializers import (
    InvestigationDetailsSerializer,
    InvestigationSerializer,
)
from sentry.investigations.endpoints.validators import InvestigationCreateValidator
from sentry.investigations.models import (
    Investigation,
    InvestigationStatus,
)
from sentry.investigations.services import (
    create_manual_investigation,
    create_template_investigation,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationsIndexEndpoint(OrganizationInvestigationsBaseEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        requested_status = request.GET.get("status", InvestigationStatus.ACTIVE)
        if requested_status not in InvestigationStatus.values:
            return Response(
                {"detail": "Must be active or archived."}, status=status.HTTP_400_BAD_REQUEST
            )
        # A source-backed investigation supersedes earlier revisions of the same
        # lineage, so only the newest revision is listed.
        newer_lineage_revision = Investigation.objects.annotate(
            compatibility_lineage_key=Coalesce("source_key", "lineage_key")
        ).filter(
            organization_id=OuterRef("organization_id"),
            compatibility_lineage_key=OuterRef("compatibility_lineage_key"),
            status=requested_status,
            source_revision__gt=OuterRef("source_revision"),
        )
        investigations = (
            Investigation.objects.filter(organization=organization, status=requested_status)
            .annotate(compatibility_lineage_key=Coalesce("source_key", "lineage_key"))
            .filter(Q(compatibility_lineage_key__isnull=True) | ~Exists(newer_lineage_revision))
        )
        query = request.GET.get("query")
        if query:
            investigations = investigations.filter(title__icontains=query)
        return self.paginate(
            request=request,
            queryset=investigations,
            paginator_cls=DateTimePaginator,
            order_by="-date_updated",
            on_results=lambda values: serialize(
                list(values), request.user, InvestigationSerializer()
            ),
        )

    def post(self, request: Request, organization: Organization) -> Response:
        require_authenticated_user(request)
        validator = InvestigationCreateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = validator.validated_data
        project_ids = request.access.accessible_project_ids
        try:
            if "template_key" in values:
                with transaction.atomic(using=router.db_for_write(Investigation)):
                    investigation, created = create_template_investigation(
                        organization=organization,
                        user_id=user_id(request),
                        template_key=values["template_key"],
                        template_version=values["template_version"],
                        source=values["source"],
                        supplied_parameters=values.get("parameters", {}),
                        accessible_project_ids=project_ids,
                        title=values.get("title"),
                    )
                    if not created:
                        require_investigation_project_access(investigation, project_ids)
                    schedule_eligible_auto_run_blocks(
                        investigation_id=investigation.id,
                        user_id=user_id(request),
                    )
            else:
                created = True
                requested_project_ids = values.get("project_ids", [])
                if not set(requested_project_ids).issubset(project_ids):
                    return Response(
                        {"detail": "One or more projects are inaccessible."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                investigation = create_manual_investigation(
                    organization=organization,
                    user_id=user_id(request),
                    title=values["title"],
                    project_ids=requested_project_ids,
                    filters=values.get("filters", {}),
                )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize(
                investigation,
                request.user,
                InvestigationDetailsSerializer(accessible_project_ids=project_ids),
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
