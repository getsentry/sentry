from __future__ import annotations

from typing import Any, TypedDict
from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ConflictError, ResourceDoesNotExist
from sentry.api.helpers.creator import get_creator_reference
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationNotebooksBaseEndpoint,
    require_notebook_writer,
    require_project_access,
)
from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.notebooks.models import Notebook, NotebookWorkflowRun
from sentry.notebooks.services import NotebookConflictError, NotebookValidationError
from sentry.notebooks.services.workflow import (
    content_revision,
    deliver_finalizer,
    link_writer_run,
    open_workflow_notebook,
    save_summary,
)
from sentry.seer.agent.embed_widgets import get_embed_widgets
from sentry.seer.agent_token import is_agent_auth
from sentry.seer.auth import SeerRpcViewerContextAuthentication
from sentry.service_accounts.auth import is_service_account_auth
from sentry.service_accounts.endpoints.organization_service_account_viewer_context import (
    SeerSystemViewerContextPermission,
)

WORKFLOW_RUN_ID = OpenApiParameter(
    "workflow_run_id",
    OpenApiTypes.UUID,
    OpenApiParameter.PATH,
    description="UUID of the parent workflow execution in Seer.",
)


class OpenWorkflowNotebook(StrictCamelSnakeValidator[None]):
    notebook_id = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Existing notebook ID to open. Omit to create a notebook for this run.",
    )
    title = serializers.CharField(
        max_length=255, help_text="Title to use when creating a notebook."
    )
    project_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        default=list,
        help_text="Project IDs for a newly created notebook.",
    )


class SummaryWrite(StrictCamelSnakeValidator[None]):
    block_id = serializers.IntegerField(min_value=1, help_text="ID of the saved embed block.")
    version = serializers.IntegerField(
        min_value=1, help_text="Version of the block used to generate the finding."
    )
    finding = serializers.RegexField(
        r"\A[^\r\n]+\Z", max_length=2000, help_text="One sentence describing what the widget shows."
    )


class MetadataWrite(StrictCamelSnakeValidator[None]):
    title = serializers.CharField(max_length=255, help_text="Generated notebook title.")
    summary = serializers.CharField(max_length=255, help_text="Short summary of the notebook.")
    description = serializers.CharField(
        max_length=5000, help_text="Longer description of the findings."
    )


class StepsWrite(StrictCamelSnakeValidator[None]):
    suggestions = serializers.ListField(
        child=serializers.DictField(),
        max_length=10,
        help_text="Suggested next steps with a key, title and rationale.",
    )


class FinalizerWrite(StrictCamelSnakeValidator[None]):
    revision = serializers.RegexField(
        "^[a-f0-9]{64}$", help_text="Content revision returned by the final notebook read."
    )
    section = serializers.ChoiceField(
        choices=["metadata", "nextSteps"], help_text="Completed finalizer to deliver."
    )
    result = serializers.DictField(
        help_text="Structured metadata or suggestions produced by this finalizer."
    )


class WorkflowNotebookContext(TypedDict):
    widgets: list[dict[str, Any]]
    notebookId: str | None
    revision: str | None
    writerRunUuid: str | None


class OpenedNotebook(TypedDict):
    notebookId: str
    version: int


class SavedSummary(TypedDict):
    version: int
    summary: str


@extend_schema(
    tags=["Notebooks"],
    parameters=[
        GlobalParams.ORG_ID_OR_SLUG,
        WORKFLOW_RUN_ID,
    ],
)
@cell_silo_endpoint
class OrganizationNotebookWorkflowEndpoint(OrganizationNotebooksBaseEndpoint):
    """Headless producer contract. Block content is read from the ordinary Notebook API."""

    publish_status = dict.fromkeys(("GET", "POST", "PATCH", "PUT"), ApiPublishStatus.PRIVATE)

    def convert_args(
        self, request: Request, organization_id_or_slug: str | int, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        if not (is_agent_auth(request.auth) or is_service_account_auth(request.auth)):
            raise PermissionDenied
        binding = (
            NotebookWorkflowRun.objects.select_related("notebook", "writer_run")
            .filter(organization=kwargs["organization"], run_id=kwargs["workflow_run_id"])
            .first()
        )
        if binding:
            require_notebook_writer(request, binding.notebook)
        kwargs["binding"] = binding
        return args, kwargs

    @extend_schema(
        operation_id="getWorkflowNotebookContext",
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "WorkflowNotebookContext", WorkflowNotebookContext
            )
        },
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        workflow_run_id: UUID,
        binding: NotebookWorkflowRun | None,
    ) -> Response:
        """Retrieve the caller's block widgets and the current notebook content revision."""
        widgets = [
            w for w in get_embed_widgets(organization, request.user) if "block" in w["level"]
        ]
        return Response(
            {
                "widgets": widgets,
                "notebookId": str(binding.notebook_id) if binding else None,
                "revision": content_revision(binding.notebook) if binding else None,
                "writerRunUuid": str(binding.writer_run.uuid)
                if binding and binding.writer_run
                else None,
            }
        )

    @extend_schema(
        operation_id="openWorkflowNotebook",
        request=OpenWorkflowNotebook,
        responses={
            200: inline_sentry_response_serializer("OpenedWorkflowNotebook", OpenedNotebook)
        },
    )
    def post(
        self,
        request: Request,
        organization: Organization,
        workflow_run_id: UUID,
        binding: NotebookWorkflowRun | None,
    ) -> Response:
        """Bind this run to an existing notebook or create its destination exactly once."""
        validator = OpenWorkflowNotebook(data=request.data)
        validator.is_valid(raise_exception=True)
        values = validator.validated_data
        destination = None
        if "notebook_id" in values:
            destination = Notebook.objects.filter(
                organization=organization, pk=values["notebook_id"], status="active"
            ).first()
            if destination is None:
                raise ResourceDoesNotExist
        require_notebook_writer(request, destination)
        if destination is None and binding is None:
            require_project_access(request, values["project_ids"])
        try:
            notebook = open_workflow_notebook(
                organization,
                workflow_run_id,
                destination=destination,
                creator=get_creator_reference(request),
                title=values["title"],
                project_ids=values["project_ids"],
            )
        except NotebookValidationError as error:
            raise serializers.ValidationError(error.errors) from error
        except NotebookConflictError as error:
            raise ConflictError(str(error)) from error
        require_notebook_writer(request, notebook)
        return Response({"notebookId": str(notebook.id), "version": notebook.version})

    @extend_schema(
        operation_id="summarizeWorkflowNotebookBlock",
        request=SummaryWrite,
        responses={
            200: inline_sentry_response_serializer("SavedWorkflowNotebookSummary", SavedSummary)
        },
    )
    def patch(
        self,
        request: Request,
        organization: Organization,
        workflow_run_id: UUID,
        binding: NotebookWorkflowRun | None,
    ) -> Response:
        """Attach the finding to the exact block version used to generate it."""
        if binding is None:
            raise ResourceDoesNotExist
        validator = SummaryWrite(data=request.data)
        validator.is_valid(raise_exception=True)
        try:
            block = save_summary(binding.notebook, **validator.validated_data)
        except NotebookConflictError as error:
            raise ConflictError(str(error)) from error
        return Response({"version": block.version, "summary": block.embed_summary})

    @extend_schema(
        operation_id="finalizeWorkflowNotebook", request=FinalizerWrite, responses={204: None}
    )
    def put(
        self,
        request: Request,
        organization: Organization,
        workflow_run_id: UUID,
        binding: NotebookWorkflowRun | None,
    ) -> Response:
        """Deliver one finalizer's result for the completed content revision."""
        if binding is None:
            raise ResourceDoesNotExist
        validator = FinalizerWrite(data=request.data)
        validator.is_valid(raise_exception=True)
        values = validator.validated_data
        section = values["section"]
        result = (MetadataWrite if section == "metadata" else StepsWrite)(data=values["result"])
        result.is_valid(raise_exception=True)
        try:
            deliver_finalizer(binding, values["revision"], section, result.validated_data)
        except NotebookConflictError as error:
            raise ConflictError(str(error)) from error
        return Response(status=204)


class WriterRunWrite(StrictCamelSnakeValidator[None]):
    seer_run_state_id = serializers.IntegerField(
        min_value=1,
        max_value=2**63 - 1,
        help_text="Seer state ID of the Explorer child that wrote the notebook.",
    )
    user_id = serializers.IntegerField(
        min_value=1,
        allow_null=True,
        help_text="Acting user for the writer, or null for a service account.",
    )


class LinkedWriter(TypedDict):
    writerRunUuid: str


@cell_silo_endpoint
class OrganizationNotebookWorkflowWriterEndpoint(OrganizationEndpoint):
    """Only the authenticated Seer worker can register a child run in Sentry's mirror."""

    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}
    authentication_classes = (SeerRpcViewerContextAuthentication,)
    permission_classes = (SeerSystemViewerContextPermission,)

    @extend_schema(
        operation_id="linkWorkflowNotebookWriter",
        tags=["Notebooks"],
        request=WriterRunWrite,
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WORKFLOW_RUN_ID,
        ],
        responses={
            200: inline_sentry_response_serializer("LinkedWorkflowNotebookWriter", LinkedWriter)
        },
    )
    def put(self, request: Request, organization: Organization, workflow_run_id: UUID) -> Response:
        """Attach the authenticated worker's Explorer run to an existing workflow notebook."""
        validator = WriterRunWrite(data=request.data)
        validator.is_valid(raise_exception=True)
        try:
            writer = link_writer_run(
                organization,
                workflow_run_id,
                validator.validated_data["seer_run_state_id"],
                validator.validated_data["user_id"],
            )
        except NotebookWorkflowRun.DoesNotExist:
            raise ResourceDoesNotExist from None
        except NotebookConflictError as error:
            raise ConflictError(str(error)) from error
        return Response({"writerRunUuid": str(writer)})
