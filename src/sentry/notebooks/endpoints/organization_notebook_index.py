from __future__ import annotations

from django.db.models import Exists, OuterRef, Q, QuerySet, Subquery
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.creator import get_creator_reference
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, NotebookParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationNotebooksBaseEndpoint,
    organization_project_ids,
    require_authenticated_user,
    service_error,
)
from sentry.notebooks.endpoints.serializers import (
    NotebookDetailsSerializer,
    NotebookDetailsSerializerResponse,
    NotebookSerializer,
    NotebookSerializerResponse,
)
from sentry.notebooks.endpoints.validators import NotebookCreateValidator
from sentry.notebooks.models import Notebook, NotebookStatus
from sentry.notebooks.services import create_manual_notebook
from sentry.notebooks.services.producer import filter_by_run_status, known_run_statuses
from sentry.notebooks.telemetry import record_notebook_started
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer_workflow_outputs.models import SeerWorkflowOutputLink

SORT_ORDER = {"dateUpdated": "-date_updated", "dateCreated": "-date_added"}
TRIGGERS = ("me", "user", "automation")


def filter_by_trigger(
    notebooks: QuerySet[Notebook],
    organization: Organization,
    trigger: str | None,
    strategy: str | None,
    viewer_id: int | None,
) -> QuerySet[Notebook]:
    if trigger == "me":
        return notebooks.filter(created_by_id=viewer_id)
    if trigger == "user":
        return notebooks.filter(created_by_id__isnull=False)
    if trigger != "automation" and strategy is None:
        return notebooks
    # Matches the list's trigger attribution: an investigation a user created belongs to that
    # user even when an automation later reuses it, and the earliest run link is the one that
    # started it.
    first_run_strategy = (
        SeerWorkflowOutputLink.objects.filter(
            notebook_id=OuterRef("id"),
            execution__run__organization_id=organization.id,
            execution__run__workflow_config__isnull=False,
        )
        .order_by("id")
        .values("execution__run__workflow_config__strategy")[:1]
    )
    notebooks = notebooks.filter(created_by_id__isnull=True).annotate(
        trigger_strategy=Subquery(first_run_strategy)
    )
    if strategy is not None:
        return notebooks.filter(trigger_strategy=strategy)
    return notebooks.filter(trigger_strategy__isnull=False)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationNotebookIndexEndpoint(OrganizationNotebooksBaseEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="List an Organization's Investigations",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotebookParams.STATUS,
            NotebookParams.QUERY,
            NotebookParams.TRIGGER,
            NotebookParams.STRATEGY,
            NotebookParams.RUN_STATUS,
            NotebookParams.SORT,
            NotebookParams.CURSOR,
            NotebookParams.PER_PAGE,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListanOrganizationsInvestigationsResponse", list[NotebookSerializerResponse]
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List the latest revision of each investigation lineage, newest updated first unless sort
        says otherwise. Filter by what started an investigation with trigger and strategy, and
        by its agentic run's status with runStatus. Returns a paginated array of summaries;
        follow the Link header for more results. Requires the organizations:investigations
        feature and open organization membership.
        """
        requested_status = request.GET.get("status", NotebookStatus.ACTIVE)
        if requested_status not in NotebookStatus.values:
            return Response(
                {"detail": "Must be active or archived."}, status=status.HTTP_400_BAD_REQUEST
            )
        trigger = request.GET.get("trigger") or None
        if trigger is not None and trigger not in TRIGGERS:
            return Response(
                {"detail": "trigger must be me, user, or automation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        strategy = request.GET.get("strategy") or None
        if strategy is not None:
            if strategy not in SeerWorkflowStrategy.values:
                return Response(
                    {"detail": "Unknown automation strategy."}, status=status.HTTP_400_BAD_REQUEST
                )
            if trigger in ("me", "user"):
                return Response(
                    {"detail": "strategy only applies to investigations an automation started."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        viewer_id = acting_user_id(request.user)
        if trigger == "me" and viewer_id is None:
            return Response(
                {"detail": "trigger=me requires a user."}, status=status.HTTP_400_BAD_REQUEST
            )
        run_statuses = request.GET.getlist("runStatus")
        if not set(run_statuses).issubset(known_run_statuses()):
            return Response({"detail": "Unknown run status."}, status=status.HTTP_400_BAD_REQUEST)
        sort = request.GET.get("sort") or "dateUpdated"
        if sort not in SORT_ORDER:
            return Response(
                {"detail": "sort must be dateUpdated or dateCreated."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # A source-backed investigation supersedes earlier revisions of the same
        # lineage, so only the newest revision is listed.
        newer_lineage_revision = Notebook.objects.filter(
            organization_id=OuterRef("organization_id"),
            source_key=OuterRef("source_key"),
            status=requested_status,
            source_revision__gt=OuterRef("source_revision"),
        )
        notebooks: QuerySet[Notebook] = Notebook.objects.filter(
            organization=organization, status=requested_status
        ).filter(Q(source_key__isnull=True) | ~Exists(newer_lineage_revision))
        query = request.GET.get("query")
        if query:
            notebooks = notebooks.filter(title__icontains=query)
        notebooks = filter_by_trigger(notebooks, organization, trigger, strategy, viewer_id)
        if run_statuses:
            notebooks = filter_by_run_status(notebooks, run_statuses)
        return self.paginate(
            request=request,
            queryset=notebooks,
            paginator_cls=DateTimePaginator,
            order_by=SORT_ORDER[sort],
            on_results=lambda values: serialize(
                list(values),
                request.user,
                NotebookSerializer(),
            ),
        )

    @extend_schema(
        operation_id="Create an Investigation",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=NotebookCreateValidator,
        responses={
            201: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", NotebookDetailsSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={"title": "Checkout latency", "projectIds": [1]},
                request_only=True,
            )
        ],
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a blank notebook. Returns notebook details, blocks, parameters, and orchestration
        summary. Requires an authenticated user. Requires the organizations:investigations
        feature and open organization membership.
        """
        require_authenticated_user(request)
        validator = NotebookCreateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = validator.validated_data
        requested_project_ids = values.get("project_ids", [])
        if not set(requested_project_ids).issubset(organization_project_ids(organization)):
            return Response(
                {"detail": "One or more projects are inaccessible."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            notebook = create_manual_notebook(
                organization=organization,
                creator=get_creator_reference(request),
                title=values["title"],
                project_ids=requested_project_ids,
                filters=values.get("filters", {}),
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        record_notebook_started(notebook)
        return Response(
            serialize(
                notebook,
                request.user,
                NotebookDetailsSerializer(access=request.access),
            ),
            status=status.HTTP_201_CREATED,
        )
